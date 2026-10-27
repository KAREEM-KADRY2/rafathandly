/**
 * Convert numbers to Arabic written currency text (تفقيط المبالغ المالية بالجنيه المصري)
 */

const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const hundreds = ['', 'مائة', 'مئتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

function convertChunk(n) {
  let str = '';
  const h = Math.floor(n / 100);
  const rem = n % 100;
  const t = Math.floor(rem / 10);
  const o = rem % 10;

  if (h > 0) {
    str += hundreds[h];
  }

  if (rem > 0) {
    if (h > 0) str += ' و';
    if (rem >= 10 && rem <= 19) {
      str += teens[rem - 10];
    } else {
      if (o > 0) {
        str += ones[o];
        if (t > 0) str += ' و';
      }
      if (t > 0) {
        str += tens[t];
      }
    }
  }

  return str;
}

export function tafqeet(amount) {
  const num = Math.round(Number(amount) || 0);
  if (num === 0) return 'صفر جنيه مصري لا غير';
  if (num < 0) return 'سالب ' + tafqeet(Math.abs(num));

  const billions = Math.floor(num / 1000000000);
  const millions = Math.floor((num % 1000000000) / 1000000);
  const thousands = Math.floor((num % 1000000) / 1000);
  const remaining = num % 1000;

  const parts = [];

  if (billions > 0) {
    if (billions === 1) parts.push('مليار');
    else if (billions === 2) parts.push('ملياران');
    else if (billions >= 3 && billions <= 10) parts.push(convertChunk(billions) + ' مليارات');
    else parts.push(convertChunk(billions) + ' مليار');
  }

  if (millions > 0) {
    if (millions === 1) parts.push('مليون');
    else if (millions === 2) parts.push('مليونان');
    else if (millions >= 3 && millions <= 10) parts.push(convertChunk(millions) + ' ملايين');
    else parts.push(convertChunk(millions) + ' مليون');
  }

  if (thousands > 0) {
    if (thousands === 1) parts.push('ألف');
    else if (thousands === 2) parts.push('ألفان');
    else if (thousands >= 3 && thousands <= 10) parts.push(convertChunk(thousands) + ' آلاف');
    else parts.push(convertChunk(thousands) + ' ألف');
  }

  if (remaining > 0) {
    parts.push(convertChunk(remaining));
  }

  return 'فقط وقدره ' + parts.join(' و') + ' جنيهاً مصرياً لا غير';
}

export default tafqeet;
