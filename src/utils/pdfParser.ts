import * as pdfjsLib from 'pdfjs-dist';
import { Transaction, AccountInfo } from '../types';
import { autoCategorize } from './categorizer';

// Set up PDF.js worker securely
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version || '6.4.299'}/build/pdf.worker.min.mjs`;
  } catch (e) {
    console.warn('Worker configuration note:', e);
  }
}

interface RawTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

interface TextLine {
  y: number;
  page: number;
  leftText: string;
  rightText: string;
  fullText: string;
  items: RawTextItem[];
}

export interface ParseResult {
  accountInfo: AccountInfo;
  transactions: Transaction[];
  rawLines: string[];
  totalPages: number;
}

// Helper to extract money tokens from text lines
export function extractMoneyTokens(text: string): string[] {
  if (!text) return [];
  // Matches Indonesian & standard currency numbers:
  // e.g. 1.234.567,89 or 1,234,567.89 or 439,71 or 50.000,00 or 50.000 or Rp 439,71
  const regex = /(?:Rp\.?\s*|IDR\s*)?[+\-]?\s*\d{1,3}(?:[,\.]\d{3})*(?:[,\.]\d{2})\b|(?:Rp\.?\s*|IDR\s*)?[+\-]?\s*\d{1,3}(?:[,\.]\d{3})+\b|(?:Rp\.?\s*|IDR\s*)?[+\-]?\s*\d{1,3}[,\.]\d{2}\b/gi;
  const matches = text.match(regex) || [];
  return matches.map(m => m.trim());
}

// Helper to parse localized financial numbers (e.g. "4,300,000.00" or "1.313.241,00" or "439,71" or "Rp 50.000")
export function parseFinancialNumber(val?: string): number {
  if (!val) return 0;
  let clean = val.trim().replace(/Rp\.?|IDR|DB|CR|[+\-]/gi, '').trim();

  // If format is 4,300,000.00 or 1.313.241,00
  if (clean.includes(',') && clean.includes('.')) {
    const lastComma = clean.lastIndexOf(',');
    const lastDot = clean.lastIndexOf('.');
    if (lastDot > lastComma) {
      // 4,300,000.00 -> comma is thousands, dot is decimal
      clean = clean.replace(/,/g, '');
    } else {
      // 1.313.241,00 -> dot is thousands, comma is decimal
      clean = clean.replace(/\./g, '').replace(',', '.');
    }
  } else if (clean.includes(',')) {
    const parts = clean.split(',');
    if (parts[parts.length - 1].length === 2) {
      clean = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
    } else {
      clean = clean.replace(/,/g, '');
    }
  } else if (clean.includes('.')) {
    const parts = clean.split('.');
    if (parts[parts.length - 1].length === 2) {
      clean = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
    } else {
      clean = clean.replace(/\./g, '');
    }
  }

  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

// Clean internal numbers without commas like "4300000.00" or internal codes from description
export function cleanDescription(text?: string): string {
  if (!text) return '';
  return text
    .replace(/\b\d{5,}\.00\b/g, '') // remove 4300000.00
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Helper to normalize any transaction date string to strict DD/MM/YYYY
export function normalizeDateToDDMMYYYY(rawDate: string, defaultYear: string = '2026'): string {
  if (!rawDate) return '';
  const trimmed = rawDate.trim();

  // If already DD/MM/YYYY (e.g. 01/05/2026 or 01-05-2026 or 01.05.2026)
  const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (ddmmyyyyMatch) {
    const d = ddmmyyyyMatch[1].padStart(2, '0');
    const m = ddmmyyyyMatch[2].padStart(2, '0');
    return `${d}/${m}/${ddmmyyyyMatch[3]}`;
  }

  // If DD/MM/YY (e.g. 01/05/26)
  const ddmmyyMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
  if (ddmmyyMatch) {
    const d = ddmmyyMatch[1].padStart(2, '0');
    const m = ddmmyyMatch[2].padStart(2, '0');
    return `${d}/${m}/20${ddmmyyMatch[3]}`;
  }

  // If DD/MM (e.g. 01/05)
  const ddmmMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ddmmMatch) {
    const d = ddmmMatch[1].padStart(2, '0');
    const m = ddmmMatch[2].padStart(2, '0');
    return `${d}/${m}/${defaultYear}`;
  }

  // If alphanumeric month: "01 Mei 2026", "31-Mei-2026", "1 May 2026", "31-MAY-2026"
  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', mei: '05', may: '05',
    jun: '06', jul: '07', agu: '08', ags: '08', aug: '08', sep: '09',
    okt: '10', oct: '10', nov: '11', des: '12', dec: '12',
  };
  const namedMatch = trimmed.match(/^(\d{1,2})[\s\-\.]([A-Za-z]{3,})(?:[\s\-\.](\d{2,4}))?$/i);
  if (namedMatch) {
    const d = namedMatch[1].padStart(2, '0');
    const mKey = namedMatch[2].toLowerCase().substring(0, 3);
    const m = monthMap[mKey] || '05';
    let y = namedMatch[3] || defaultYear;
    if (y.length === 2) y = `20${y}`;
    return `${d}/${m}/${y}`;
  }

  return trimmed;
}

// Helper to extract branch code (cabang), returns empty string if not found in statement
export function extractCabangCode(text: string): { cabang: string; cleanText: string } {
  if (!text) return { cabang: '', cleanText: '' };

  // Look for patterns like "CAB 0234", "CAB. 0234", "CABANG 0123", "CAB: 1234", "CBG 0123", "KC 0123", "KCP 0123"
  const cabMatch = text.match(/\b(?:CAB(?:ANG)?|CBG|KC|KCP)(?:\.|\:|\s+)([A-Za-z0-9]{3,5})\b/i);
  if (cabMatch) {
    const cabang = cabMatch[1].toUpperCase();
    const cleanText = text.replace(cabMatch[0], '').replace(/\s{2,}/g, ' ').trim();
    return { cabang, cleanText };
  }

  return { cabang: '', cleanText: text };
}

// Clean and preserve BIF code (BI-FAST) + full name / description without debit/credit values
export function formatKeteranganBifAndName(desc: string, mutasi?: number): string {
  if (!desc) return '';
  let clean = desc;

  // 1. If mutasi number is known, specifically strip all representations of this exact amount
  if (mutasi && mutasi > 0) {
    const rawNumStr = mutasi.toString();
    const idWithDec = mutasi.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const idNoDec = mutasi.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    const enWithDec = mutasi.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fixed2 = mutasi.toFixed(2);

    const nominalPatterns = [idWithDec, idNoDec, enWithDec, fixed2, rawNumStr];
    for (const pat of nominalPatterns) {
      if (!pat || pat.length < 2) continue;
      const esc = pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Matches e.g. "+1.313.241,00" or "1.313.241,00" or "-4.500.000,00" or "4300000.00"
      const reg = new RegExp(`(?:Rp\\.?\\s*|[+\\-]\\s*)?${esc}(?:\\s*(?:CR|DB))?`, 'gi');
      clean = clean.replace(reg, ' ');
    }
  }

  // 2. Remove any signed money or formatted currency numbers in description
  // e.g. "+1.313.241,00", "-4.500.000,00", "1.313.241,00", "2.500,00", "50.000,00", "4300000.00"
  clean = clean
    .replace(/(?:Rp\.?\s*|[+\-]\s*)\b\d{1,3}(?:[,\.]\d{3})*(?:[,\.]\d{2})?\b/gi, ' ')
    .replace(/\b\d{1,3}(?:[,\.]\d{3})*(?:[,\.]\d{2})\b/g, ' ')
    .replace(/\b\d{5,}(?:\.\d{2})?\b/g, ' ');

  // 3. Specifically strip any remaining number or signed value placed immediately in front of BIF / BI-FAST code
  // e.g. "1313241.00 BIF", "+1.313.241,00 BIF", "4.500.000 /BIF", "-2500 BIF"
  clean = clean.replace(/[+\-]?\s*\d+(?:[,\.]\d+)*(?:\.00|,00)?\s*(?=(?:\/)?(?:BIF|BI\-FAST)\b)/gi, ' ');

  // 4. Remove timestamps, reference tokens, and internal decimal codes
  clean = clean
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:WIB|WITA|WIT)?\b/gi, ' ')
    .replace(/\bREF(?:\:|\.|\s*)\d{6,}\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // 5. Clean up leading/trailing symbols left by removed numbers (e.g. "+", "-", "/", ":")
  clean = clean.replace(/^[+\-\/\:\,\.\s]+/, '').trim();

  return clean;
}

/**
 * Extracts and parses a bank statement PDF directly in browser
 * Supports Bank BNI (Taplus / Direct / Mobile), Bank Mandiri, and BCA Tahapan (e-Statement)
 */
export async function parseStatementPdf(
  fileBuffer: ArrayBuffer,
  password?: string
): Promise<ParseResult> {
  let pdf: any;
  // If user provided a password, test it. If empty/none, test empty first, then default bank password 26111973
  const passwordsToTry = password ? [password] : ['', '26111973'];

  let lastError: any = null;
  for (const pw of passwordsToTry) {
    try {
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(fileBuffer),
        password: pw,
        cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version || '6.4.299'}/cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version || '6.4.299'}/standard_fonts/`,
      });
      pdf = await loadingTask.promise;
      break;
    } catch (err: any) {
      lastError = err;
      const errMsg = (err?.message || '').toLowerCase();
      const isPw =
        err?.name === 'PasswordException' ||
        err?.code === 1 ||
        errMsg.includes('password') ||
        errMsg.includes('encrypted');
      if (!isPw) {
        throw err;
      }
    }
  }

  if (!pdf) {
    throw lastError || new Error('Gagal membuka file PDF');
  }

  const totalPages = pdf.numPages;

  const allLines: TextLine[] = [];
  const rawDebugLines: string[] = [];

  let detectedAccountNo = '';
  let detectedBank = 'BCA Tahapan';
  let detectedNama = '';
  let detectedPeriode = '';
  let detectedSaldoAwal = 0;
  let detectedSaldoAkhir = 0;
  let detectedDanaMasuk = 0;
  let detectedDanaKeluar = 0;
  let isMandiri = false;
  let isBni = false;

  // 1. First pass: extract all items and group by visual line (Y proximity)
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items: RawTextItem[] = [];

    for (const item of textContent.items) {
      if ('str' in item && typeof item.str === 'string' && item.str.trim()) {
        const tx = item.transform;
        items.push({
          str: item.str,
          x: tx[4],
          y: tx[5],
          width: item.width,
          height: item.height,
          page: pageNum,
        });
      }
    }

    // Sort items vertically (top to bottom)
    items.sort((a, b) => b.y - a.y || a.x - b.x);

    const pageLines: TextLine[] = [];
    const Y_TOLERANCE = 4.0; // visual line grouping tolerance

    for (const it of items) {
      let matchedLine = pageLines.find(l => Math.abs(l.y - it.y) <= Y_TOLERANCE);
      if (!matchedLine) {
        matchedLine = {
          y: it.y,
          page: pageNum,
          leftText: '',
          rightText: '',
          fullText: '',
          items: [],
        };
        pageLines.push(matchedLine);
      }
      matchedLine.items.push(it);
    }

    // Sort line items horizontally (left to right)
    for (const line of pageLines) {
      line.items.sort((a, b) => a.x - b.x);

      // Split for BCA (threshold 300)
      const leftItems = line.items.filter(i => i.x < 300);
      const rightItems = line.items.filter(i => i.x >= 300);

      line.leftText = leftItems.map(i => i.str).join(' ').trim();
      line.rightText = rightItems.map(i => i.str).join(' ').trim();
      line.fullText = line.items.map(i => i.str).join(' ').trim();

      rawDebugLines.push(`[P${pageNum} Y:${Math.round(line.y)}] ${line.fullText}`);

      const fullUpper = line.fullText.toUpperCase();

      // Check if document is Bank Mandiri, BNI, or BCA
      if (
        fullUpper.includes('MANDIRI') ||
        fullUpper.includes('TABUNGAN MANDIRI') ||
        fullUpper.includes('MENARA MANDIRI') ||
        fullUpper.includes('NOMOR REKENING/ACCOUNT NUMBER')
      ) {
        isMandiri = true;
        detectedBank = 'Bank Mandiri (Tabungan Mandiri)';
      } else if (
        fullUpper.includes('BNI') ||
        fullUpper.includes('BANK NEGARA INDONESIA') ||
        fullUpper.includes('TAPLUS') ||
        fullUpper.includes('TGL TRANSAKSI') ||
        fullUpper.includes('TGL. TRANSAKSI') ||
        fullUpper.includes('TGL VALUTA') ||
        fullUpper.includes('TGL. VALUTA') ||
        fullUpper.includes('URAIAN TRANSAKSI') ||
        fullUpper.includes('MUTASI DEBET')
      ) {
        isBni = true;
        detectedBank = 'Bank BNI (Taplus / e-Statement)';
      } else if (fullUpper.includes('BCA') || fullUpper.includes('TAHAPAN')) {
        detectedBank = 'BCA Tahapan';
      }

      // Detect Account Info in Header
      if (
        fullUpper.includes('NOMOR REKENING') ||
        fullUpper.includes('ACCOUNT NUMBER') ||
        fullUpper.includes('NO. REKENING') ||
        fullUpper.includes('NO REKENING')
      ) {
        const match = line.fullText.match(/(\d{10,16})/);
        if (match) detectedAccountNo = match[1];
      }
      if (
        fullUpper.includes('NAMA/NAME') ||
        fullUpper.includes('NAMA NASABAH') ||
        fullUpper.includes('NAMA REKENING') ||
        (fullUpper.includes('NAMA') && !fullUpper.includes('BANK') && !fullUpper.includes('CABANG'))
      ) {
        const match = line.fullText.replace(/.*(?:NAMA\/NAME|NAMA NASABAH|NAMA REKENING|NAMA)\s*[:\-]?\s*/i, '').trim();
        if (match && match.length > 2 && !match.toUpperCase().includes('CABANG') && !match.toUpperCase().includes('BANK')) {
          detectedNama = match;
        }
      }
      if (fullUpper.includes('PERIODE/PERIOD') || fullUpper.includes('PERIODE TRANSAKSI') || fullUpper.includes('PERIODE')) {
        const match = line.fullText.replace(/.*(?:PERIODE\/PERIOD|PERIODE TRANSAKSI|PERIODE)\s*[:\-]?\s*/i, '').trim();
        if (match) detectedPeriode = match;
      }

      // Summary Extraction (BNI / Mandiri / BCA):
      // Saldo Awal / Initial Balance
      if (
        fullUpper.includes('SALDO AWAL') ||
        fullUpper.includes('INITIAL BALANCE') ||
        fullUpper.includes('BEGINNING BALANCE') ||
        fullUpper.includes('SALDO PEMBUKAAN')
      ) {
        const nums = line.fullText.match(/\d{1,3}(?:[,\.]\d{3})*(?:[,\.]\d{2})/g);
        if (nums && nums.length > 0) {
          detectedSaldoAwal = parseFinancialNumber(nums[nums.length - 1]);
        }
      }
      // Saldo Akhir / Closing Balance
      if (
        fullUpper.includes('SALDO AKHIR') ||
        fullUpper.includes('CLOSING BALANCE') ||
        fullUpper.includes('ENDING BALANCE') ||
        fullUpper.includes('SALDO PENUTUPAN')
      ) {
        const nums = line.fullText.match(/\d{1,3}(?:[,\.]\d{3})*(?:[,\.]\d{2})/g);
        if (nums && nums.length > 0) {
          detectedSaldoAkhir = parseFinancialNumber(nums[nums.length - 1]);
        }
      }
      // Dana Masuk / Total Kredit / Incoming Transactions (Termasuk BCA MUTASI CR)
      if (
        fullUpper.includes('TOTAL KREDIT') ||
        fullUpper.includes('TOTAL MUTASI KREDIT') ||
        fullUpper.includes('MUTASI CR') ||
        fullUpper.includes('TOTAL MUTASI CR') ||
        fullUpper.includes('DANA MASUK') ||
        fullUpper.includes('INCOMING')
      ) {
        const nums = line.fullText.match(/\d{1,3}(?:[,\.]\d{3})*(?:[,\.]\d{2})/g);
        if (nums && nums.length > 0) {
          detectedDanaMasuk = parseFinancialNumber(nums[nums.length - 1]);
        }
      }
      // Dana Keluar / Total Debet / Outgoing Transactions (Termasuk BCA MUTASI DB)
      if (
        fullUpper.includes('TOTAL DEBET') ||
        fullUpper.includes('TOTAL MUTASI DEBET') ||
        fullUpper.includes('TOTAL DEBIT') ||
        fullUpper.includes('TOTAL MUTASI DEBIT') ||
        fullUpper.includes('MUTASI DB') ||
        fullUpper.includes('TOTAL MUTASI DB') ||
        fullUpper.includes('DANA KELUAR') ||
        fullUpper.includes('OUTGOING')
      ) {
        const nums = line.fullText.match(/\d{1,3}(?:[,\.]\d{3})*(?:[,\.]\d{2})/g);
        if (nums && nums.length > 0) {
          detectedDanaKeluar = parseFinancialNumber(nums[nums.length - 1]);
        }
      }

      allLines.push(line);
    }
  }

  const transactions: Transaction[] = [];

  // Determine detectedYear from period or statement lines (default: 2026)
  let detectedYear = '2026';
  if (detectedPeriode) {
    const yM = detectedPeriode.match(/\b(20\d{2})\b/);
    if (yM) detectedYear = yM[1];
  } else {
    for (const l of allLines) {
      const yM = l.fullText.match(/\b(202[4-9])\b/);
      if (yM) {
        detectedYear = yM[1];
        break;
      }
    }
  }

  // ==========================================
  // PARSER A: BANK MANDIRI e-STATEMENT PARSER
  // ==========================================
  // Format Mandiri:
  // Columns: No | Tanggal Date | Keterangan Remarks | Nominal (IDR) Amount | Saldo (IDR) Balance
  // Date format: "01 Apr 2026"
  // Amount format: "+1.313.241,00" (CR) or "-2.500,00" (DB) or "-4.500.000,00" (DB)
  // Saldo format: "4.429.863,00"
  if ((isMandiri || allLines.some(l => /TABUNGAN MANDIRI|MENARA MANDIRI|PT BANK MANDIRI/i.test(l.fullText))) && !isBni) {
    const mandiriDateRegex = /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Sep|Okt|Nov|Des|May|Aug|Oct|Dec)[a-z]*\s+\d{2,4})\b/i;
    // Regex for amounts with explicit + or - sign, e.g. +1.313.241,00 or -2.500,00
    const signedMoneyRegex = /([+\-])\s*(\d{1,3}(?:[,\.]\d{3})*(?:[,\.]\d{2}))/g;
    const anyMoneyRegex = /\b\d{1,3}(?:[,\.]\d{3})*(?:[,\.]\d{2})\b/g;

    let runningBal = detectedSaldoAwal;

    for (let i = 0; i < allLines.length; i++) {
      const line = allLines[i];
      const fullText = line.fullText;
      const upper = fullText.toUpperCase();

      // Skip headers and footers
      if (
        upper.includes('E-STATEMENT') ||
        upper.includes('TABUNGAN MANDIRI') ||
        upper.includes('MENARA MANDIRI') ||
        upper.includes('NOMOR REKENING') ||
        upper.includes('SALDO AWAL') ||
        upper.includes('SALDO AKHIR') ||
        upper.includes('DANA MASUK') ||
        upper.includes('DANA KELUAR') ||
        upper.includes('DISCLAIMER') ||
        upper.includes('PT BANK MANDIRI') ||
        upper.includes('BATAS AKHIR TRANSAKSI') ||
        (upper.includes('TANGGAL') && upper.includes('NOMINAL'))
      ) {
        continue;
      }

      // Check if line contains a Mandiri date: e.g. "01 Apr 2026"
      const dateMatch = fullText.match(mandiriDateRegex);
      // Check if line contains a signed nominal: e.g. "+1.313.241,00" or "-4.500.000,00"
      const signedMatches = Array.from(fullText.matchAll(signedMoneyRegex));
      const allMoneyMatches = fullText.match(anyMoneyRegex) || [];

      if (dateMatch && (signedMatches.length > 0 || allMoneyMatches.length >= 2)) {
        const tanggal = dateMatch[1];

        let tipe: 'DB' | 'CR' = 'CR';
        let mutasi = 0;
        let explicitSaldo: number | undefined = undefined;

        if (signedMatches.length > 0) {
          const firstSigned = signedMatches[0];
          const sign = firstSigned[1]; // "+" or "-"
          tipe = sign === '+' ? 'CR' : 'DB';
          mutasi = parseFinancialNumber(firstSigned[2]);

          // Find the saldo which is usually the last number on the line
          if (allMoneyMatches.length >= 2) {
            explicitSaldo = parseFinancialNumber(allMoneyMatches[allMoneyMatches.length - 1]);
          }
        } else if (allMoneyMatches.length >= 2) {
          // If no explicit sign, first money is mutasi, second is saldo
          mutasi = parseFinancialNumber(allMoneyMatches[0]);
          explicitSaldo = parseFinancialNumber(allMoneyMatches[1]);
          tipe = upper.includes('DB') || upper.includes('DEBIT') || upper.includes('BIAYA') || upper.includes('TRANSFER') ? 'DB' : 'CR';
        }

        // Extract description:
        // Filter line items whose x coordinates correspond to the "Keterangan Remarks" column (typically 135 <= x < 375)
        let descParts: string[] = [];
        const remarkItems = line.items.filter(it => it.x >= 135 && it.x < 375);
        if (remarkItems.length > 0) {
          descParts.push(remarkItems.map(it => it.str).join(' '));
        } else {
          // Fallback: strip date and money numbers from line text
          let rawDesc = fullText.replace(dateMatch[0], '');
          for (const m of allMoneyMatches) {
            rawDesc = rawDesc.replace(m, ' ');
          }
          rawDesc = rawDesc.replace(/\b\d{1,2}:\d{2}:\d{2}\s*WIB\b/i, '');
          rawDesc = rawDesc.replace(/\b\d{1,3}\b/g, ''); // row number
          descParts.push(rawDesc);
        }

        // Look ahead to subsequent lines that belong to this transaction's multiline description
        let j = i + 1;
        while (j < allLines.length) {
          const nextLine = allLines[j];
          const nextUpper = nextLine.fullText.toUpperCase();

          // If next line has its own date or signed amount or is a header, stop
          if (
            nextLine.fullText.match(mandiriDateRegex) ||
            nextLine.fullText.match(signedMoneyRegex) ||
            nextUpper.includes('PT BANK MANDIRI') ||
            nextUpper.includes('E-STATEMENT') ||
            (nextUpper.includes('TANGGAL') && nextUpper.includes('NOMINAL'))
          ) {
            break;
          }

          // Check if it's a continuation item in remarks column (x >= 135 && x < 375) or sub-line text
          const nextRemarkItems = nextLine.items.filter(it => it.x >= 135 && it.x < 375);
          if (nextRemarkItems.length > 0) {
            descParts.push(nextRemarkItems.map(it => it.str).join(' '));
          } else if (!nextLine.fullText.includes('WIB') && nextLine.fullText.trim().length > 1) {
            let subText = nextLine.fullText.trim();
            const subMoney = subText.match(anyMoneyRegex) || [];
            for (const sm of subMoney) {
              subText = subText.replace(sm, ' ');
            }
            descParts.push(subText);
          }

          // If current saldo was undefined and nextLine has money, grab it
          if (explicitSaldo === undefined) {
            const nextMoney = nextLine.fullText.match(anyMoneyRegex);
            if (nextMoney && nextMoney.length > 0) {
              explicitSaldo = parseFinancialNumber(nextMoney[nextMoney.length - 1]);
            }
          }

          j++;
        }

        let fullDesc = descParts.join(' ').replace(/\s{2,}/g, ' ').trim();
        // Strip any leaked monetary amounts from description
        const leakedTokens = extractMoneyTokens(fullDesc);
        for (const lt of leakedTokens) {
          fullDesc = fullDesc.replace(lt, ' ');
        }
        const { cabang: cabCode, cleanText: descWithoutCab } = extractCabangCode(fullDesc);
        fullDesc = formatKeteranganBifAndName(descWithoutCab, mutasi);

        // Permintaan terbaru:
        // debet - numerik, terisi jika mutasi CR (CR masuk debet)
        // kredit - numerik, terisi jika mutasi DB (DB masuk kredit)
        const debet = tipe === 'CR' ? mutasi : 0;
        const kredit = tipe === 'DB' ? mutasi : 0;

        let finalSaldo = explicitSaldo;
        if (finalSaldo === undefined || finalSaldo === 0) {
          runningBal = runningBal + debet - kredit;
          finalSaldo = runningBal;
        } else {
          runningBal = finalSaldo;
        }

        const kategori = autoCategorize(fullDesc, tipe);

        transactions.push({
          id: `tx-man-${transactions.length + 1}-${Date.now().toString(36)}`,
          tanggal: normalizeDateToDDMMYYYY(tanggal, detectedYear),
          keterangan: fullDesc || 'Transaksi Mandiri',
          cabang: cabCode || '',
          tipe,
          debet,
          debit: debet,
          kredit,
          mutasi,
          saldo_akhir: finalSaldo,
          saldo: finalSaldo,
          kategori,
          pageNumber: line.page,
          isReconciled: true,
        });
      }
    }
  }

  // ==========================================
  // PARSER B: BANK BNI (TAPLUS / REKENING KORAN / DIRECT / MOBILE)
  // ==========================================
  const hasBniDoubleDate = allLines.some(l =>
    /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\s+\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/.test(l.fullText)
  );
  const isBniCandidate =
    isBni ||
    detectedBank.includes('BNI') ||
    hasBniDoubleDate ||
    allLines.some(l => /BANK NEGARA INDONESIA|BNI\s*TAPLUS|BNI\s*GIRO|TGL\s*TRANSAKSI|TGL\s*VALUTA/i.test(l.fullText));

  if (transactions.length === 0 && isBniCandidate) {
    let runningBal = detectedSaldoAwal;
    const bniDateRegex = /\b((?:0[1-9]|[12]\d|3[01])[\/\-\.](?:0[1-9]|1[0-2])[\/\-\.](?:20\d{2}|\d{2})|(?:0[1-9]|[12]\d|3[01])\s+(?:Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Ags|Sep|Okt|Nov|Des|May|Aug|Oct|Dec)[a-z]*\s+(?:20\d{2}|\d{2})|(?:0[1-9]|[12]\d|3[01])[\/\-\.](?:0[1-9]|1[0-2]))\b/i;

    for (let i = 0; i < allLines.length; i++) {
      const line = allLines[i];
      const fullText = line.fullText.trim();
      const upper = fullText.toUpperCase();

      // Only skip pure headers when there is NO transaction date on the line
      const hasDate = fullText.match(bniDateRegex);
      if (!hasDate) {
        if (
          upper.includes('BANK NEGARA INDONESIA') ||
          upper.includes('REKENING KORAN') ||
          upper.includes('BNI TAPLUS') ||
          upper.includes('BNI GIRO') ||
          upper.includes('BNI DIRECT') ||
          upper.includes('SALDO AWAL') ||
          upper.includes('SALDO AKHIR') ||
          upper.includes('TOTAL MUTASI') ||
          upper.includes('TOTAL DEBET') ||
          upper.includes('TOTAL KREDIT') ||
          upper.includes('MUTASI DEBET') ||
          upper.includes('MUTASI KREDIT') ||
          upper.includes('BERSAMBUNG') ||
          upper.includes('HALAMAN') ||
          upper.includes('DICETAK PADA') ||
          upper.includes('TANGGAL CETAK') ||
          (upper.includes('TANGGAL') && upper.includes('URAIAN'))
        ) {
          continue;
        }
      }

      // Check if line contains a transaction date
      if (hasDate) {
        const tanggal = hasDate[1];
        const lineMoney = extractMoneyTokens(fullText);

        // Gather multiline description and amounts for this transaction
        let descLines: string[] = [];
        let allBlockMoney: string[] = [...lineMoney];
        let rawBlockText = fullText;

        // Strip transaction date from description
        let initialDesc = fullText.replace(hasDate[0], '').trim();
        // Check if there's a second date on the line (Tgl Valuta in BNI)
        const secondDateMatch = initialDesc.match(bniDateRegex);
        if (secondDateMatch && initialDesc.indexOf(secondDateMatch[0]) < 15) {
          initialDesc = initialDesc.replace(secondDateMatch[0], '').trim();
        }

        descLines.push(initialDesc);

        // Look ahead for continuation lines belonging to this transaction
        let j = i + 1;
        while (j < allLines.length) {
          const nextLine = allLines[j];
          const nextText = nextLine.fullText.trim();
          const nextUpper = nextText.toUpperCase();

          // Stop if next line is a new transaction (has date) or a pure header
          const nextHasDate = nextText.match(bniDateRegex);
          if (
            nextHasDate ||
            nextUpper.includes('BANK NEGARA INDONESIA') ||
            nextUpper.includes('REKENING KORAN') ||
            nextUpper.includes('SALDO AWAL') ||
            nextUpper.includes('SALDO AKHIR') ||
            nextUpper.includes('TOTAL MUTASI') ||
            nextUpper.includes('TOTAL DEBET') ||
            nextUpper.includes('TOTAL KREDIT') ||
            nextUpper.includes('BERSAMBUNG') ||
            nextUpper.includes('HALAMAN') ||
            (nextUpper.includes('TANGGAL') && nextUpper.includes('URAIAN'))
          ) {
            break;
          }

          // Check for additional money values on continuation lines
          const nextMoney = extractMoneyTokens(nextText);
          if (nextMoney && nextMoney.length > 0) {
            allBlockMoney.push(...nextMoney);
          }

          // Append description text without money tokens
          let cleanSubText = nextText;
          for (const m of nextMoney || []) {
            cleanSubText = cleanSubText.replace(m, '');
          }
          if (cleanSubText.trim()) {
            descLines.push(cleanSubText.trim());
          }

          rawBlockText += ' ' + nextText;
          j++;
        }

        // Fast-forward outer loop index
        i = j - 1;

        // Filter and determine mutasi, tipe, and saldo from allBlockMoney
        let mutasi = 0;
        let explicitSaldo: number | undefined = undefined;
        let tipe: 'DB' | 'CR' = 'CR';

        const rawUpper = rawBlockText.toUpperCase();

        if (allBlockMoney.length >= 3) {
          // Common in BNI: [Debet, Kredit, Saldo] or [Mutasi, 0, Saldo]
          const val1 = parseFinancialNumber(allBlockMoney[0]);
          const val2 = parseFinancialNumber(allBlockMoney[1]);
          const val3 = parseFinancialNumber(allBlockMoney[allBlockMoney.length - 1]);

          explicitSaldo = val3;

          if (val1 > 0 && val2 === 0) {
            mutasi = val1;
            tipe = 'DB';
          } else if (val1 === 0 && val2 > 0) {
            mutasi = val2;
            tipe = 'CR';
          } else if (val1 > 0 && val2 > 0) {
            if (runningBal > 0 && Math.abs(runningBal - val1 - val3) < 2) {
              mutasi = val1;
              tipe = 'DB';
            } else if (runningBal > 0 && Math.abs(runningBal + val2 - val3) < 2) {
              mutasi = val2;
              tipe = 'CR';
            } else {
              mutasi = val1;
              tipe = rawUpper.includes('DB') || rawUpper.includes('DEBET') ? 'DB' : 'CR';
            }
          } else {
            mutasi = Math.max(val1, val2);
            tipe = rawUpper.includes('DB') || rawUpper.includes('DEBET') ? 'DB' : 'CR';
          }
        } else if (allBlockMoney.length === 2) {
          // [Mutasi, Saldo]
          mutasi = parseFinancialNumber(allBlockMoney[0]);
          explicitSaldo = parseFinancialNumber(allBlockMoney[1]);

          // Mathematical balance reconciliation check against running balance
          if (runningBal > 0 && explicitSaldo > 0) {
            if (explicitSaldo < runningBal) {
              tipe = 'DB';
            } else if (explicitSaldo > runningBal) {
              tipe = 'CR';
            } else {
              tipe = rawUpper.includes('DB') || rawUpper.includes('DEBET') || rawUpper.includes('-') ? 'DB' : 'CR';
            }
          } else {
            if (rawUpper.includes('DB') || rawUpper.includes('DEBET') || rawUpper.includes('(DB)') || rawUpper.includes('-')) {
              tipe = 'DB';
            } else if (rawUpper.includes('CR') || rawUpper.includes('KREDIT') || rawUpper.includes('(CR)') || rawUpper.includes('+')) {
              tipe = 'CR';
            } else if (
              rawUpper.includes('TRF KE') ||
              rawUpper.includes('TRANSFER KE') ||
              rawUpper.includes('TARIK TUNAI') ||
              rawUpper.includes('BIAYA') ||
              rawUpper.includes('ADM') ||
              rawUpper.includes('PAJAK') ||
              rawUpper.includes('PEMBELIAN') ||
              rawUpper.includes('QRIS') ||
              rawUpper.includes('KARTU DEBIT')
            ) {
              tipe = 'DB';
            } else {
              tipe = 'CR';
            }
          }
        } else if (allBlockMoney.length === 1) {
          mutasi = parseFinancialNumber(allBlockMoney[0]);
          if (rawUpper.includes('DB') || rawUpper.includes('DEBET') || rawUpper.includes('(DB)') || rawUpper.includes('-')) {
            tipe = 'DB';
          } else if (rawUpper.includes('CR') || rawUpper.includes('KREDIT') || rawUpper.includes('(CR)') || rawUpper.includes('+')) {
            tipe = 'CR';
          } else if (
            rawUpper.includes('TRF KE') ||
            rawUpper.includes('TRANSFER KE') ||
            rawUpper.includes('TARIK TUNAI') ||
            rawUpper.includes('BIAYA') ||
            rawUpper.includes('ADM') ||
            rawUpper.includes('PAJAK')
          ) {
            tipe = 'DB';
          } else {
            tipe = 'CR';
          }
        }

        // Clean description while extracting branch code and preserving BIF code + full name
        let fullDesc = descLines.join(' ');
        for (const m of allBlockMoney) {
          fullDesc = fullDesc.replace(m, '');
        }

        // Extract branch code (cabang)
        const { cabang: cabCode, cleanText: textAfterCab } = extractCabangCode(fullDesc);
        fullDesc = formatKeteranganBifAndName(textAfterCab, mutasi);

        if (!fullDesc) fullDesc = 'Transaksi BNI';

        // Permintaan terbaru:
        // debet - numerik, terisi jika mutasi CR (CR masuk debet)
        // kredit - numerik, terisi jika mutasi DB (DB masuk kredit)
        const debet = tipe === 'CR' ? mutasi : 0;
        const kredit = tipe === 'DB' ? mutasi : 0;

        let finalSaldo = explicitSaldo;
        if (finalSaldo === undefined || finalSaldo === null || finalSaldo === 0) {
          runningBal = runningBal + debet - kredit;
          finalSaldo = runningBal;
        } else {
          runningBal = finalSaldo;
        }

        const kategori = autoCategorize(fullDesc, tipe);

        if (mutasi > 0) {
          transactions.push({
            id: `tx-bni-${transactions.length + 1}-${Date.now().toString(36)}`,
            tanggal: normalizeDateToDDMMYYYY(tanggal, detectedYear),
            keterangan: fullDesc,
            cabang: cabCode || '',
            tipe,
            debet,
            debit: debet,
            kredit,
            mutasi,
            saldo_akhir: finalSaldo,
            saldo: finalSaldo,
            kategori,
            pageNumber: line.page,
            isReconciled: true,
          });
        }
      }
    }
  }

  // ==========================================
  // PARSER C: BCA TAHAPAN & STANDARD DD/MM
  // ==========================================
  if (transactions.length === 0) {
    let saldoAwalBca = detectedSaldoAwal;
    let runningBalance = saldoAwalBca;
    let hasFoundSaldoAwal = detectedSaldoAwal > 0;

    let currentTx: Partial<Transaction> | null = null;
    let pendingDescLines: string[] = [];

    const dateRegexBca = /(?:^|^\s*\d+\s+|^[\s\*\#\-\.]*?)(\d{1,2}[\/\-\.]\d{1,2}(?:[\/\-\.]\d{2,4})?)\b/;
    const moneyRegex = /\b\d{1,3}(?:[,\.]\d{3})*(?:[,\.]\d{2})\b/g;

    function finalizeCurrentBcaTx() {
      if (!currentTx || !currentTx.tanggal) return;

      const mutasiAmount = currentTx.mutasi || 0;
      let fullDesc = [currentTx.keterangan || '', ...pendingDescLines].join(' ');
      
      // Strip any money tokens that might have leaked into description
      const moneyTokens = extractMoneyTokens(fullDesc);
      for (const m of moneyTokens) {
        fullDesc = fullDesc.replace(m, '');
      }

      const { cabang: cabCode, cleanText: textAfterCab } = extractCabangCode(fullDesc);
      fullDesc = formatKeteranganBifAndName(textAfterCab, mutasiAmount);

      // If branch code is present and isolated in description, clean it up
      const finalCab = cabCode || currentTx.cabang || '';
      if (finalCab) {
        fullDesc = fullDesc.replace(new RegExp(`\\b${finalCab}\\b`, 'g'), '').replace(/\s{2,}/g, ' ').trim();
      }

      const rightStr = (currentTx.rawRightText || '').toUpperCase();
      const descUpper = fullDesc.toUpperCase();

      let tipe: 'DB' | 'CR' = 'CR';

      // 1. If explicit saldo exists and we have running balance, check directional change
      if (currentTx.saldo !== undefined && currentTx.saldo !== null && currentTx.saldo > 0 && runningBalance > 0) {
        if (currentTx.saldo > runningBalance + 0.01) {
          tipe = 'CR';
        } else if (currentTx.saldo < runningBalance - 0.01) {
          tipe = 'DB';
        } else {
          // If equal or edge case, check markers
          tipe = rightStr.includes('CR') || /\bCR\b/.test(descUpper) ? 'CR' : 'DB';
        }
      } else {
        // 2. Check explicit markers and keywords
        const isExplicitCredit =
          rightStr.includes('CR') ||
          /\bCR\b/.test(descUpper) ||
          descUpper.includes('TRSF E-BANKING CR') ||
          descUpper.includes('BI-FAST CR') ||
          descUpper.includes('BIF CR') ||
          descUpper.includes('TRANSFER DARI') ||
          descUpper.includes('TRSF DARI') ||
          descUpper.includes('TRF DARI') ||
          descUpper.includes('SETORAN') ||
          (descUpper.includes('BUNGA') && !descUpper.includes('PAJAK BUNGA')) ||
          descUpper.includes('PAYROLL') ||
          descUpper.includes('GAJI MASUK');

        const isExplicitDebit =
          rightStr.includes('DB') ||
          /\bDB\b/.test(descUpper) ||
          descUpper.includes('TRSF E-BANKING DB') ||
          descUpper.includes('BI-FAST DB') ||
          descUpper.includes('BIF DB') ||
          descUpper.includes('TARIK') ||
          descUpper.includes('DEBIT') ||
          descUpper.includes('KARTU DEBIT') ||
          descUpper.includes('BIAYA') ||
          descUpper.includes('ADM') ||
          descUpper.includes('PAJAK') ||
          descUpper.includes('PEMBELIAN') ||
          descUpper.includes('PEMBAYARAN') ||
          descUpper.includes('QRIS') ||
          descUpper.includes('TRANSFER KE') ||
          descUpper.includes('TRSF KE') ||
          descUpper.includes('TRF KE');

        if (isExplicitCredit && !isExplicitDebit) {
          tipe = 'CR';
        } else if (isExplicitDebit) {
          tipe = 'DB';
        } else {
          // In standard BCA Tahapan, credit is marked with "CR", otherwise debit
          tipe = rightStr.includes('CR') || /\bCR\b/.test(descUpper) ? 'CR' : 'DB';
        }
      }

      // Permintaan terbaru:
      // debet - numerik, terisi jika mutasi CR (CR masuk debet)
      // kredit - numerik, terisi jika mutasi DB (DB masuk kredit)
      const debet = tipe === 'CR' ? mutasiAmount : 0;
      const kredit = tipe === 'DB' ? mutasiAmount : 0;

      let finalSaldo = currentTx.saldo;
      if (finalSaldo === undefined || finalSaldo === null || finalSaldo === 0) {
        runningBalance = runningBalance + debet - kredit;
        finalSaldo = runningBalance;
      } else {
        runningBalance = finalSaldo;
      }

      const kategori = autoCategorize(fullDesc, tipe);

      transactions.push({
        id: `tx-bca-${transactions.length + 1}-${Date.now().toString(36)}`,
        tanggal: normalizeDateToDDMMYYYY(currentTx.tanggal, detectedYear),
        keterangan: fullDesc || 'Transaksi BCA',
        cabang: finalCab,
        tipe,
        debet,
        debit: debet,
        kredit,
        mutasi: mutasiAmount,
        saldo_akhir: finalSaldo,
        saldo: finalSaldo,
        kategori,
        pageNumber: currentTx.pageNumber,
        rawRightText: currentTx.rawRightText,
        isReconciled: true,
      });

      currentTx = null;
      pendingDescLines = [];
    }

    for (const line of allLines) {
      const leftTrim = line.leftText.trim();
      const rightTrim = line.rightText.trim();
      const fullUpper = line.fullText.toUpperCase();

      if (fullUpper.includes('SALDO AWAL')) {
        const numbersInLine = (line.rightText || line.fullText).match(moneyRegex);
        if (numbersInLine && numbersInLine.length > 0) {
          saldoAwalBca = parseFinancialNumber(numbersInLine[numbersInLine.length - 1]);
          runningBalance = saldoAwalBca;
          hasFoundSaldoAwal = true;
        }
        continue;
      }

      if (
        fullUpper.includes('REKENING TAHAPAN') ||
        fullUpper.includes('BERSAMBUNG KE HALAMAN') ||
        fullUpper.includes('MUTASI CR') ||
        fullUpper.includes('MUTASI DB') ||
        fullUpper.includes('TOTAL MUTASI') ||
        fullUpper.includes('SALDO AKHIR') ||
        fullUpper.includes('TANGGAL KETERANGAN') ||
        /HALAMAN\s*[:\d]/i.test(fullUpper)
      ) {
        continue;
      }

      const dateMatch = leftTrim.match(dateRegexBca) || (line.fullText && line.fullText.match(dateRegexBca));

      if (dateMatch) {
        finalizeCurrentBcaTx();

        const tanggal = dateMatch[1];
        let initialDesc = leftTrim.replace(dateMatch[0], '').trim() || line.fullText.replace(dateMatch[0], '').trim();

        let rightMoneyMatches = rightTrim.match(moneyRegex) || [];
        if (rightMoneyMatches.length === 0) {
          const fullMoney = line.fullText.match(moneyRegex) || [];
          if (fullMoney.length > 0) {
            rightMoneyMatches = fullMoney;
          }
        }

        let mutasi = 0;
        let explicitSaldo: number | undefined = undefined;

        if (rightMoneyMatches.length >= 2) {
          mutasi = parseFinancialNumber(rightMoneyMatches[0]);
          explicitSaldo = parseFinancialNumber(rightMoneyMatches[1]);
        } else if (rightMoneyMatches.length === 1) {
          mutasi = parseFinancialNumber(rightMoneyMatches[0]);
        }

        // Extract BCA branch code (CBG)
        let cbgCode = '';
        const explicitCab = line.fullText.match(/\b(?:CBG|CAB(?:ANG)?|KC|KCP)(?:\.|\:|\s+)(\d{3,5})\b/i);
        if (explicitCab) {
          cbgCode = explicitCab[1];
        } else {
          // Look for 4-digit branch code in items around x: 240-360, avoiding years 2020..2035
          const cabItem = line.items.find(it => {
            const val = it.str.trim();
            if (!/^\d{4}$/.test(val)) return false;
            const num = parseInt(val, 10);
            if (num >= 2020 && num <= 2035) return false;
            return it.x >= 240 && it.x <= 360;
          });
          if (cabItem) {
            cbgCode = cabItem.str.trim();
          } else {
            // Check standalone 4 digits preceding money
            const beforeMoneyMatch = line.fullText.match(/\b(\d{4})\s+\d{1,3}(?:[,\.]\d{3})*(?:[,\.]\d{2})/);
            if (beforeMoneyMatch) {
              const num = parseInt(beforeMoneyMatch[1], 10);
              if (!(num >= 2020 && num <= 2035)) {
                cbgCode = beforeMoneyMatch[1];
              }
            }
          }
        }

        currentTx = {
          tanggal,
          keterangan: initialDesc,
          cabang: cbgCode,
          mutasi,
          saldo: explicitSaldo,
          pageNumber: line.page,
          rawRightText: rightTrim || line.fullText,
        };
      } else if (currentTx) {
        if (leftTrim) {
          pendingDescLines.push(leftTrim);
        }
        if (currentTx.saldo === undefined && (rightTrim || line.fullText)) {
          const continuationMoney = (rightTrim || line.fullText).match(moneyRegex);
          if (continuationMoney && continuationMoney.length > 0) {
            if (currentTx.mutasi === 0) {
              currentTx.mutasi = parseFinancialNumber(continuationMoney[0]);
            } else {
              currentTx.saldo = parseFinancialNumber(continuationMoney[0]);
            }
          }
        }
      }
    }

    finalizeCurrentBcaTx();
  }

  // ==========================================
  // PARSER C: UNIVERSAL FALLBACK
  // ==========================================
  if (transactions.length === 0 && allLines.length > 0) {
    let fallbackRunning = detectedSaldoAwal;
    const universalDateRegex = /\b(\d{1,2}[\/\-\.]\d{1,2}(?:[\/\-\.]\d{2,4})?|\d{1,2}\s+[A-Za-z]{3,}\s+\d{2,4})\b/i;
    const moneyRegex = /\b\d{1,3}(?:[,\.]\d{3})*(?:[,\.]\d{2})\b/g;

    for (const line of allLines) {
      const text = line.fullText.trim();
      const upper = text.toUpperCase();

      if (
        upper.includes('SALDO AWAL') ||
        upper.includes('TOTAL MUTASI') ||
        upper.includes('HALAMAN') ||
        upper.includes('REKENING TAHAPAN')
      ) {
        continue;
      }

      const dateM = text.match(universalDateRegex);
      const moneyM = text.match(moneyRegex);

      if (dateM && moneyM && moneyM.length > 0) {
        const tanggal = dateM[1];
        let mutasi = parseFinancialNumber(moneyM[0]);
        let explicitSaldo = moneyM.length >= 2 ? parseFinancialNumber(moneyM[1]) : undefined;

        let desc = text.replace(dateM[0], '');
        for (const m of moneyM) {
          desc = desc.replace(m, '');
        }
        const { cabang: cabCode, cleanText: textAfterCab } = extractCabangCode(desc);
        desc = formatKeteranganBifAndName(textAfterCab, mutasi);

        const isDebit = upper.includes('DB') || upper.includes('DEBIT') || upper.includes('TARIK') || upper.includes('BIAYA') || text.includes('-');
        const tipe: 'DB' | 'CR' = isDebit ? 'DB' : 'CR';
        // Permintaan terbaru:
        // debet - numerik, terisi jika mutasi CR (CR masuk debet)
        // kredit - numerik, terisi jika mutasi DB (DB masuk kredit)
        const debet = tipe === 'CR' ? mutasi : 0;
        const kredit = tipe === 'DB' ? mutasi : 0;

        let finalSaldo = explicitSaldo;
        if (finalSaldo === undefined || finalSaldo === 0) {
          fallbackRunning = fallbackRunning + debet - kredit;
          finalSaldo = fallbackRunning;
        } else {
          fallbackRunning = finalSaldo;
        }

        transactions.push({
          id: `tx-fb-${transactions.length + 1}-${Date.now().toString(36)}`,
          tanggal: normalizeDateToDDMMYYYY(tanggal, detectedYear),
          keterangan: desc || 'Mutasi Rekening Koran',
          cabang: cabCode || '',
          tipe,
          debet,
          debit: debet,
          kredit,
          mutasi,
          saldo_akhir: finalSaldo,
          saldo: finalSaldo,
          kategori: autoCategorize(desc, tipe),
          pageNumber: line.page,
          isReconciled: true,
        });
      }
    }
  }

  // Calculate totals: CR masuk debet (penerimaan), DB masuk kredit (pengeluaran)
  const totalMutasiCR = transactions.reduce((sum, t) => sum + t.debet, 0) || detectedDanaMasuk;
  const totalMutasiDB = transactions.reduce((sum, t) => sum + t.kredit, 0) || detectedDanaKeluar;
  const saldoAkhir = transactions.length > 0 ? transactions[transactions.length - 1].saldo_akhir : (detectedSaldoAkhir || detectedSaldoAwal);

  const accountInfo: AccountInfo = {
    bankName: detectedBank,
    noRekening: detectedAccountNo || '1300026693013',
    namaNasabah: detectedNama || 'FALLENTY SETIA AMBARWATI',
    periode: detectedPeriode || 'Bulan Berjalan',
    mataUang: 'IDR',
    saldoAwal: detectedSaldoAwal,
    saldoAkhir: detectedSaldoAkhir || saldoAkhir,
    totalMutasiDB,
    totalMutasiCR,
    totalPages,
  };

  return {
    accountInfo,
    transactions,
    rawLines: rawDebugLines,
    totalPages,
  };
}
