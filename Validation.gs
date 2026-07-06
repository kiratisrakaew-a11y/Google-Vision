function normalizeTaxId_(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeAmount_(value) {
  var cleaned = String(value || '')
    .replace(/,/g, '')
    .replace(/[฿บาท\sA-Za-z]/g, '')
    .replace(/[^0-9.\-]/g, '');

  if (!cleaned) {
    return '';
  }

  var number = Number(cleaned);
  if (isNaN(number)) {
    return cleaned;
  }

  return number.toFixed(2);
}

function normalizeDate_(value) {
  var text = String(value || '').trim();
  if (!text) {
    return '';
  }

  var isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return formatDateParts_(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  var slashMatch = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (slashMatch) {
    return formatDateParts_(Number(slashMatch[3]), Number(slashMatch[2]), Number(slashMatch[1]));
  }

  var thaiMonths = {
    'มกราคม': 1,
    'กุมภาพันธ์': 2,
    'มีนาคม': 3,
    'เมษายน': 4,
    'พฤษภาคม': 5,
    'มิถุนายน': 6,
    'กรกฎาคม': 7,
    'สิงหาคม': 8,
    'กันยายน': 9,
    'ตุลาคม': 10,
    'พฤศจิกายน': 11,
    'ธันวาคม': 12
  };

  var thaiMatch = text.match(/(\d{1,2})\s*([ก-๙]+)\s*(\d{4})/);
  if (thaiMatch && thaiMonths[thaiMatch[2]]) {
    return formatDateParts_(Number(thaiMatch[3]), thaiMonths[thaiMatch[2]], Number(thaiMatch[1]));
  }

  return text;
}

function normalizeYear_(year) {
  if (year < 100) {
    return year + 2000;
  }

  if (year > 2400) {
    return year - 543;
  }

  return year;
}

function formatDateParts_(year, month, day) {
  year = normalizeYear_(year);
  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0')
  ].join('-');
}

function validateInvoice_(invoice) {
  var missingFields = getMissingFields_(invoice);
  var lowConfidenceFields = getLowConfidenceFields_(invoice);
  var blockingLowConfidenceFields = getBlockingLowConfidenceFields_(invoice);
  var overallConfidence = calculateOverallConfidence_(invoice);
  var lowestRequiredConfidence = calculateLowestRequiredConfidence_(invoice);
  var amountCheck = validateAmountConsistency_(invoice);
  var vatRateCheck = validateVatRate_(invoice);
  var taxIdValid = validateTaxId_(invoice.supplier_tax_id.value);
  var reviewStatus = 'OK';

  if (missingFields.length || blockingLowConfidenceFields.length || overallConfidence < CONFIG.OVERALL_CONFIDENCE_THRESHOLD || !amountCheck.valid || !taxIdValid) {
    reviewStatus = 'NEEDS_REVIEW';
  }

  return {
    overallConfidence: roundConfidence_(overallConfidence),
    lowestFieldConfidence: roundConfidence_(lowestRequiredConfidence),
    reviewStatus: reviewStatus,
    missingFields: missingFields,
    lowConfidenceFields: lowConfidenceFields,
    blockingLowConfidenceFields: blockingLowConfidenceFields,
    amountCheck: amountCheck,
    vatRateCheck: vatRateCheck,
    taxIdValid: taxIdValid
  };
}

function calculateOverallConfidence_(invoice) {
  var score = 0;
  var totalWeight = 0;

  Object.keys(CONFIDENCE_WEIGHTS).forEach(function (field) {
    var weight = CONFIDENCE_WEIGHTS[field];
    var confidence = invoice[field] ? Number(invoice[field].confidence || 0) : 0;

    score += confidence * weight;
    totalWeight += weight;
  });

  return totalWeight ? score / totalWeight : 0;
}

function calculateLowestRequiredConfidence_(invoice) {
  var values = REQUIRED_FIELDS.map(function (field) {
    return invoice[field] && invoice[field].value ? Number(invoice[field].confidence || 0) : 0;
  });

  return values.length ? Math.min.apply(null, values) : 0;
}

function getMissingFields_(invoice) {
  return REQUIRED_FIELDS.filter(function (field) {
    return !invoice[field] || !invoice[field].value;
  });
}

function getLowConfidenceFields_(invoice) {
  return getLowConfidenceFieldsByFieldNames_(invoice, Object.keys(FIELD_THRESHOLDS));
}

function getBlockingLowConfidenceFields_(invoice) {
  return getLowConfidenceFieldsByFieldNames_(invoice, REQUIRED_FIELDS);
}

function getLowConfidenceFieldsByFieldNames_(invoice, fieldNames) {
  return fieldNames.filter(function (field) {
    if (!invoice[field] || !invoice[field].value || typeof FIELD_THRESHOLDS[field] !== 'number') {
      return false;
    }

    return Number(invoice[field].confidence || 0) < FIELD_THRESHOLDS[field];
  }).map(function (field) {
    return field + ': ' + roundConfidence_(invoice[field].confidence);
  });
}

function validateTaxId_(taxId) {
  return /^\d{13}$/.test(String(taxId || ''));
}

function validateAmountConsistency_(invoice) {
  var subtotal = parseAmount_(invoice.subtotal.value);
  var vat = parseAmount_(invoice.vat.value);
  var total = parseAmount_(invoice.total.value);

  if (subtotal === null || vat === null || total === null) {
    return {
      valid: true,
      skipped: true,
      message: 'Skipped because subtotal, VAT, or total is missing.'
    };
  }

  var difference = Math.abs((subtotal + vat) - total);
  return {
    valid: difference <= CONFIG.AMOUNT_TOLERANCE,
    skipped: false,
    message: 'subtotal + vat vs total difference = ' + difference.toFixed(2)
  };
}

function validateVatRate_(invoice) {
  var subtotal = parseAmount_(invoice.subtotal.value);
  var vat = parseAmount_(invoice.vat.value);

  if (subtotal === null || vat === null) {
    return {
      valid: true,
      skipped: true,
      message: 'Skipped because subtotal or VAT is missing.'
    };
  }

  var expectedVat = subtotal * CONFIG.VAT_RATE;
  var difference = Math.abs(expectedVat - vat);

  return {
    valid: difference <= CONFIG.AMOUNT_TOLERANCE,
    skipped: false,
    message: 'VAT vs configured rate difference = ' + difference.toFixed(2)
  };
}

function parseAmount_(value) {
  if (value === '' || value === null || typeof value === 'undefined') {
    return null;
  }

  var number = Number(value);
  return isNaN(number) ? null : number;
}

function roundConfidence_(value) {
  return Math.round(Number(value || 0) * 10000) / 10000;
}
