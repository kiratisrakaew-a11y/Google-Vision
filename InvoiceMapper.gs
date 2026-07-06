const ENTITY_ALIASES = {
  supplier_name: ['supplier_name'],
  supplier_tax_id: ['supplier_tax_id'],
  invoice_no: ['invoice_id'],
  invoice_date: ['invoice_date'],
  due_date: ['due_date'],
  subtotal: ['net_amount', 'subtotal'],
  vat: ['total_tax_amount', 'tax_amount'],
  total: ['total_amount', 'amount_due'],
  currency: ['currency']
};

function mapInvoiceFields_(document) {
  var entities = document.entities || [];

  var invoice = {
    supplier_name: createField_('', 0),
    supplier_tax_id: createField_('', 0),
    invoice_no: createField_('', 0),
    invoice_date: createField_('', 0),
    due_date: createField_('', 0),
    subtotal: createField_('', 0),
    vat: createField_('', 0),
    total: createField_('', 0),
    currency: createField_('THB', 0)
  };

  Object.keys(ENTITY_ALIASES).forEach(function (fieldName) {
    var entity = findBestEntity_(entities, ENTITY_ALIASES[fieldName]);
    if (!entity) {
      return;
    }

    invoice[fieldName] = createField_(getEntityValue_(entity), Number(entity.confidence || 0));
  });

  invoice.supplier_tax_id.value = normalizeTaxId_(invoice.supplier_tax_id.value);
  invoice.invoice_date.value = normalizeDate_(invoice.invoice_date.value);
  invoice.due_date.value = normalizeDate_(invoice.due_date.value);
  invoice.subtotal.value = normalizeAmount_(invoice.subtotal.value);
  invoice.vat.value = normalizeAmount_(invoice.vat.value);
  invoice.total.value = normalizeAmount_(invoice.total.value);
  invoice.currency.value = invoice.currency.value || 'THB';

  return invoice;
}

function createField_(value, confidence) {
  return {
    value: value || '',
    confidence: typeof confidence === 'number' ? confidence : 0
  };
}

function findBestEntity_(entities, aliases) {
  var best = null;

  entities.forEach(function (entity) {
    if (aliases.indexOf(entity.type) === -1) {
      return;
    }

    if (!best || Number(entity.confidence || 0) > Number(best.confidence || 0)) {
      best = entity;
    }
  });

  return best;
}

function getEntityValue_(entity) {
  if (entity.normalizedValue && entity.normalizedValue.text) {
    return String(entity.normalizedValue.text).trim();
  }

  return String(entity.mentionText || '').trim();
}
