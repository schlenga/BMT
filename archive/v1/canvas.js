// canvas.js — Business Model Canvas view & editing
'use strict';

var Canvas = (function() {

  var ELEMENTS_BASE = [
    { key: 'keyPartners', label: 'Key Partners', icon: '🤝', hint: 'Who helps you deliver?' },
    { key: 'keyActivities', label: 'Key Activities', icon: '⚡', hint: 'What do you do daily?' },
    { key: 'keyResources', label: 'Key Resources', icon: '🔑', hint: 'What do you need?' },
    { key: 'valueProp', label: 'Value Proposition', icon: '💎', hint: 'Why do customers choose you?' },
    { key: 'customerRelationships', label: 'Customer Relationships', icon: '💬', hint: 'How do you interact?' },
    { key: 'channels', label: 'Channels', icon: '📢', hint: 'How do you reach customers?' },
    { key: 'customerSegments', label: 'Customer Segments', icon: '👥', hint: 'Who are your customers?' },
    { key: 'costStructure', label: 'Cost Structure', icon: '💸', hint: 'What are your main costs?' },
    { key: 'revenueStreams', label: 'Revenue Streams', icon: '💰', hint: 'How do you earn money?' }
  ];

  function getElements() {
    var biz = Store.getBusiness();
    var type = biz ? biz.type : 'service';
    var t = AI.getTerminology(type);
    return ELEMENTS_BASE.map(function(el) {
      return {
        key: el.key,
        label: t[el.key] || el.label,
        icon: el.icon,
        hint: el.hint
      };
    });
  }

  // Backwards-compatible reference
  var ELEMENTS = ELEMENTS_BASE;

  var editingItem = null; // { element, id }

  function render(container) {
    var canvas = Store.getCanvas();
    var hyps = Store.getHypotheses();
    var biz = Store.getBusiness();
    var elements = getElements();

    var h = '';
    h += '<div class="canvas-header">';
    h += '<h2 class="page-title">' + esc(biz ? biz.name : 'Business Model Canvas') + '</h2>';
    h += '<p class="page-subtitle">Click any item to edit. Add new items with the + button.</p>';
    h += '</div>';

    h += '<div class="bmc-grid">';

    // Row 1: Partners | Activities+Resources | Value Prop | Relationships+Channels | Segments
    h += '<div class="bmc-cell bmc-tall bmc-partners">' + renderCell('keyPartners', canvas, hyps, elements) + '</div>';
    h += '<div class="bmc-cell-split">';
    h += '<div class="bmc-cell bmc-half">' + renderCell('keyActivities', canvas, hyps, elements) + '</div>';
    h += '<div class="bmc-cell bmc-half">' + renderCell('keyResources', canvas, hyps, elements) + '</div>';
    h += '</div>';
    h += '<div class="bmc-cell bmc-tall bmc-value">' + renderCell('valueProp', canvas, hyps, elements) + '</div>';
    h += '<div class="bmc-cell-split">';
    h += '<div class="bmc-cell bmc-half">' + renderCell('customerRelationships', canvas, hyps, elements) + '</div>';
    h += '<div class="bmc-cell bmc-half">' + renderCell('channels', canvas, hyps, elements) + '</div>';
    h += '</div>';
    h += '<div class="bmc-cell bmc-tall bmc-segments">' + renderCell('customerSegments', canvas, hyps, elements) + '</div>';

    // Row 2: Costs | Revenue
    h += '<div class="bmc-cell bmc-wide bmc-costs">' + renderCell('costStructure', canvas, hyps, elements) + '</div>';
    h += '<div class="bmc-cell bmc-wide bmc-revenue">' + renderCell('revenueStreams', canvas, hyps, elements) + '</div>';

    h += '</div>'; // end bmc-grid

    container.innerHTML = h;
    bindCanvasEvents(container);
  }

  function renderCell(elementKey, canvas, hyps, elements) {
    var el = elements.find(function(e) { return e.key === elementKey; });
    var items = canvas[elementKey] || [];
    var hypCount = hyps.filter(function(h) { return h.canvasElement === elementKey; }).length;

    var h = '<div class="bmc-cell-header">';
    h += '<span class="bmc-icon">' + el.icon + '</span>';
    h += '<span class="bmc-label">' + el.label + '</span>';
    if (hypCount > 0) h += '<span class="bmc-hyp-badge">' + hypCount + '</span>';
    h += '</div>';

    h += '<div class="bmc-items">';
    items.forEach(function(item) {
      var itemHyps = hyps.filter(function(h) { return h.canvasElement === elementKey; });
      var statusClass = getItemStatus(itemHyps);

      if (editingItem && editingItem.element === elementKey && editingItem.id === item.id) {
        h += '<div class="bmc-item editing">';
        h += '<input class="bmc-edit-input" data-element="' + elementKey + '" data-id="' + item.id + '" value="' + esc(item.text) + '" autofocus>';
        h += '<button class="bmc-item-btn bmc-save" data-element="' + elementKey + '" data-id="' + item.id + '" title="Save">&#10003;</button>';
        h += '<button class="bmc-item-btn bmc-delete" data-element="' + elementKey + '" data-id="' + item.id + '" title="Remove">&times;</button>';
        h += '</div>';
      } else {
        h += '<div class="bmc-item ' + statusClass + '" data-element="' + elementKey + '" data-id="' + item.id + '">';
        h += '<span class="bmc-item-text">' + esc(item.text) + '</span>';
        h += '</div>';
      }
    });
    h += '</div>';

    h += '<button class="bmc-add" data-element="' + elementKey + '">+ Add</button>';
    return h;
  }

  function getItemStatus(hyps) {
    if (!hyps || hyps.length === 0) return '';
    var hasValidated = hyps.some(function(h) { return h.status === 'validated'; });
    var hasInvalidated = hyps.some(function(h) { return h.status === 'invalidated'; });
    var hasTesting = hyps.some(function(h) { return h.status === 'testing'; });
    if (hasInvalidated) return 'status-risk';
    if (hasValidated && !hasTesting) return 'status-validated';
    if (hasTesting) return 'status-testing';
    return '';
  }

  function bindCanvasEvents(container) {
    // Click to edit items
    container.querySelectorAll('.bmc-item:not(.editing)').forEach(function(el) {
      el.addEventListener('click', function() {
        editingItem = { element: this.dataset.element, id: this.dataset.id };
        render(container);
      });
    });

    // Save edit
    container.querySelectorAll('.bmc-save').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var input = container.querySelector('.bmc-edit-input[data-element="' + this.dataset.element + '"]');
        if (input && input.value.trim()) {
          Store.updateCanvasItem(this.dataset.element, this.dataset.id, input.value.trim());
        }
        editingItem = null;
        render(container);
      });
    });

    // Edit input enter key
    container.querySelectorAll('.bmc-edit-input').forEach(function(input) {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          if (this.value.trim()) {
            Store.updateCanvasItem(this.dataset.element, this.dataset.id, this.value.trim());
          }
          editingItem = null;
          render(container);
        } else if (e.key === 'Escape') {
          editingItem = null;
          render(container);
        }
      });
    });

    // Delete
    container.querySelectorAll('.bmc-delete').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        Store.removeCanvasItem(this.dataset.element, this.dataset.id);
        editingItem = null;
        render(container);
      });
    });

    // Add new item
    container.querySelectorAll('.bmc-add').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var elementKey = this.dataset.element;
        var elements = getElements();
        var el = elements.find(function(e) { return e.key === elementKey; });
        var text = prompt('Add to ' + el.label + ':');
        if (text && text.trim()) {
          Store.addCanvasItem(elementKey, text.trim());
          render(container);
        }
      });
    });
  }

  function esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  return {
    render: render,
    ELEMENTS: ELEMENTS
  };
})();
