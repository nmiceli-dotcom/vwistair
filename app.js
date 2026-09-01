// Complete Client-Side App Logic (Camera Button on Every Step)
(function () {
  const STORAGE_KEY_PROPERTIES = 'vw_stair_properties';
  const STORAGE_KEY_RECORDS = 'vw_stair_records';

  let properties = JSON.parse(localStorage.getItem(STORAGE_KEY_PROPERTIES)) || [
    { id: 'spanish-palms', name: 'Spanish Palms' }
  ];
  let records = JSON.parse(localStorage.getItem(STORAGE_KEY_RECORDS)) || [];
  let currentPropertyId = properties[0]?.id || 'spanish-palms';
  let activeRecordId = records.find(r => r.propertyId === currentPropertyId)?.id || null;

  function saveState() {
    localStorage.setItem(STORAGE_KEY_PROPERTIES, JSON.stringify(properties));
    localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records));
  }

  function blockFormSubmissions() {
    document.querySelectorAll('form').forEach(form => {
      form.onsubmit = (e) => {
        e.preventDefault();
        return false;
      };
    });
  }

  function getInputValue(identifiers) {
    const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
    for (const id of identifiers) {
      const found = inputs.find(i => {
        const nameAttr = (i.getAttribute('name') || '').toLowerCase();
        const idAttr = (i.getAttribute('id') || '').toLowerCase();
        const parentText = (i.closest('label') || i.parentElement)?.textContent.toLowerCase() || '';
        return nameAttr.includes(id) || idAttr.includes(id) || parentText.includes(id);
      });
      if (found && found.value) return found.value;
    }
    return '';
  }

  function resetFormInputs() {
    const inputs = Array.from(document.querySelectorAll('input, textarea'));
    inputs.forEach(i => {
      const nameAttr = (i.getAttribute('name') || '').toLowerCase();
      const parentText = (i.closest('label') || i.parentElement)?.textContent.toLowerCase() || '';
      if (nameAttr.includes('building') || parentText.includes('building') ||
          nameAttr.includes('unit') || parentText.includes('unit')) {
        i.value = '';
      }
    });
  }

  function initPropertyDropdown() {
    const select = document.querySelector('select');
    if (select) {
      select.innerHTML = '';
      properties.forEach(prop => {
        const opt = document.createElement('option');
        opt.value = prop.id;
        opt.textContent = prop.name;
        if (prop.id === currentPropertyId) opt.selected = true;
        select.appendChild(opt);
      });

      select.onchange = (e) => {
        currentPropertyId = e.target.value;
        const propRecs = records.filter(r => r.propertyId === currentPropertyId);
        activeRecordId = propRecs.length ? propRecs[0].id : null;
        renderStaircaseList();
        renderRightPanel();
      };
    }

    document.querySelectorAll('button, a, input[type="button"]').forEach(btn => {
      if (btn.textContent.trim().toLowerCase().includes('add property')) {
        btn.onclick = (e) => {
          e.preventDefault();
          const propName = prompt('Enter new Property Name:');
          if (propName && propName.trim()) {
            const name = propName.trim();
            const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            if (!properties.some(p => p.id === id)) {
              properties.push({ id, name });
              currentPropertyId = id;
              activeRecordId = null;
              saveState();
              initPropertyDropdown();
              renderStaircaseList();
              renderRightPanel();
            }
          }
        };
      }
    });
  }

  function initStaircaseForm() {
    blockFormSubmissions();

    const handleCreate = (e) => {
      if (e) e.preventDefault();

      const building = getInputValue(['building']) || '22';
      const unit = getInputValue(['unit', 'stairwell']) || '2024';
      const periodLabel = getInputValue(['periodlabel', 'period']) || 'QRT 3 2026';
      const inspectedOn = getInputValue(['inspectedon', 'inspected']) || new Date().toISOString().split('T')[0];
      const inspector = getInputValue(['inspector']) || 'R. Okonkwo';
      const stepCount = parseInt(getInputValue(['stepcount', 'treads']) || '17', 10);
      const notes = getInputValue(['notes', 'stairwell']) || '';

      const treads = [];
      for (let i = 1; i <= stepCount; i++) {
        treads.push({ step: i, condition: 'PASS', notes: '', photos: [] });
      }

      const newRecord = {
        id: 'rec_' + Date.now(),
        propertyId: currentPropertyId,
        building,
        unit,
        periodLabel,
        inspectedOn,
        inspector,
        stepCount,
        notes,
        treads
      };

      records.push(newRecord);
      activeRecordId = newRecord.id;
      saveState();

      resetFormInputs();
      renderStaircaseList();
      renderRightPanel();
      return false;
    };

    document.querySelectorAll('form').forEach(f => f.onsubmit = handleCreate);
    document.querySelectorAll('button, input[type="submit"], .btn').forEach(btn => {
      if (btn.textContent.trim().toLowerCase().includes('create staircase record')) {
        btn.onclick = handleCreate;
      }
    });
  }

  function renderStaircaseList() {
    let listContainer = document.querySelector('#loggedStaircasesList');
    if (!listContainer) {
      const sidebar = document.querySelectorAll('div')[1] || document.body;
      listContainer = document.createElement('div');
      listContainer.id = 'loggedStaircasesList';
      listContainer.style.cssText = 'margin-top:20px; padding:15px; background:#fff; color:#111; border:1px solid #ddd; border-radius:6px;';
      
      const formBtn = document.querySelectorAll('button, input[type="submit"]')[0];
      if (formBtn && formBtn.parentElement) {
        formBtn.parentElement.appendChild(listContainer);
      } else {
        sidebar.appendChild(listContainer);
      }
    }

    const propRecords = records.filter(r => r.propertyId === currentPropertyId);

    if (propRecords.length === 0) {
      listContainer.innerHTML = '<strong style="display:block; margin-bottom:5px; font-size:12px; color:#555;">LOGGED STAIRCASES</strong><p style="font-size:12px; color:#888; margin:0;">No staircases logged for this property yet.</p>';
      return;
    }

    listContainer.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <strong style="color:#ff5722; font-size:13px;">LOGGED STAIRCASES (${propRecords.length})</strong>
        <button type="button" onclick="window.clearAllStaircases()" style="background:#e53935; color:#fff; border:none; padding:4px 8px; border-radius:3px; font-size:10px; font-weight:bold; cursor:pointer;">Clear All</button>
      </div>
      ${propRecords.map(r => {
        const flaggedCount = r.treads.filter(t => ['C', 'HSW'].includes(t.condition)).length;
        const photoCount = r.treads.filter(t => t.photos && t.photos.length > 0).length;
        const isSelected = r.id === activeRecordId;
        return `
          <div class="stair-item" data-id="${r.id}" style="padding:10px; margin-bottom:8px; border:2px solid ${isSelected ? '#ff5722' : '#ccc'}; background:${isSelected ? '#fff3e0' : '#f9f9f9'}; color:#111; border-radius:4px; cursor:pointer;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div style="font-weight:bold; font-size:14px; color:#111; padding-right:10px;">Bldg ${r.building} — Unit/Stair ${r.unit}</div>
              <button type="button" onclick="event.stopPropagation(); window.deleteStaircase('${r.id}')" title="Delete Staircase" style="background:#ffebee; color:#c62828; border:1px solid #ef9a9a; border-radius:3px; padding:2px 6px; font-size:11px; font-weight:bold; cursor:pointer;">✕ Delete</button>
            </div>
            <div style="font-size:12px; color:#555; margin-top:4px;">
              ${r.periodLabel} | ${r.treads.length} Steps | 📷 ${photoCount} Photos ${flaggedCount > 0 ? `<span style="color:#d32f2f; font-weight:bold;">| ⚠️ ${flaggedCount} Flagged</span>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    `;

    listContainer.querySelectorAll('.stair-item').forEach(item => {
      item.onclick = () => {
        activeRecordId = item.getAttribute('data-id');
        renderStaircaseList();
        renderRightPanel();
      };
    });
  }

  function renderRightPanel() {
    let mainPanel = document.querySelector('.main-panel') || document.querySelectorAll('div')[2] || document.body;
    
    const headers = Array.from(document.querySelectorAll('h3, h4, div'));
    const targetHeader = headers.find(el => el.textContent.toLowerCase().includes('no staircase selected') || el.textContent.toLowerCase().includes('step 1'));
    if (targetHeader) {
      mainPanel = targetHeader.closest('div') || mainPanel;
    }

    const record = records.find(r => r.id === activeRecordId);

    if (!record) {
      mainPanel.innerHTML = `
        <div style="padding:20px; background:#fff; color:#111; border:1px solid #ddd; border-radius:6px;">
          <h4 style="margin-top:0; color:#111;">NO STAIRCASE SELECTED</h4>
          <p style="opacity:0.8; color:#333;">Pick a staircase from the left list, or fill in the form and click "Create staircase record".</p>
          <div style="text-align:center; padding:30px; color:#666;">
            <p>Every tread is recorded, not just the damaged ones. Use the camera button on each step to attach photo evidence.</p>
          </div>
        </div>
      `;
      return;
    }

    let html = `
      <div style="padding:20px; background:#fff; color:#111; border:1px solid #ddd; border-radius:6px;">
        <div style="margin-bottom:15px; padding-bottom:10px; border-bottom:2px solid #ff5722; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h3 style="margin:0; font-size:18px; color:#111;">Building ${record.building} — Unit/Stairwell ${record.unit}</h3>
            <p style="font-size:13px; color:#555; margin-top:4px;">Inspector: <strong style="color:#111;">${record.inspector}</strong> | Period: <strong style="color:#111;">${record.periodLabel}</strong> | Date: ${record.inspectedOn}</p>
          </div>
          <button type="button" onclick="window.deleteStaircase('${record.id}')" style="background:#d32f2f; color:#fff; border:none; padding:6px 12px; border-radius:4px; font-size:12px; font-weight:bold; cursor:pointer;">Delete Staircase</button>
        </div>
        <div class="tread-grid" style="display:flex; flex-direction:column; gap:10px;">
    `;

    record.treads.forEach((tread, idx) => {
      const isFlagged = ['C', 'HSW'].includes(tread.condition);
      const hasPhoto = tread.photos && tread.photos.length > 0;

      html += `
        <div style="padding:12px; border:1px solid ${isFlagged ? '#e53935' : '#e0e0e0'}; background:${isFlagged ? '#ffebee' : '#ffffff'}; color:#111; border-radius:6px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="font-size:15px; color:#111; font-weight:800;">Step ${tread.step}</strong>
            <div style="display:flex; gap:6px;">
              ${['PASS', 'C', 'N', 'MON', 'HSW'].map(code => `
                <button type="button" 
                        onclick="window.updateTreadStatus('${record.id}', ${idx}, '${code}')"
                        style="padding:5px 10px; font-size:12px; border-radius:4px; border:1px solid #bbb; cursor:pointer; font-weight:bold; background:${tread.condition === code ? '#111' : '#fff'}; color:${tread.condition === code ? '#fff' : '#111'};">
                  ${code}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Camera Capture Row on Every Step -->
          <div style="margin-top:10px; padding-top:8px; border-top:1px dashed ${isFlagged ? '#ef9a9a' : '#eee'}; display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:10px;">
              <label style="background:${hasPhoto ? '#2e7d32' : '#ff5722'}; color:#fff; padding:6px 12px; border-radius:4px; font-size:12px; font-weight:bold; cursor:pointer; display:inline-flex; align-items:center; gap:5px; box-shadow:0 1px 3px rgba(0,0,0,0.2);">
                📷 ${hasPhoto ? 'Retake Photo' : 'Capture Photo'}
                <input type="file" accept="image/*" capture="environment" onchange="window.handlePhotoUpload('${record.id}', ${idx}, this)" style="display:none;" />
              </label>
              ${hasPhoto ? `<span style="font-size:11px; color:#2e7d32; font-weight:bold;">✓ Photo Saved</span>` : `<span style="font-size:11px; color:#777;">Optional step photo</span>`}
            </div>

            ${hasPhoto ? `
              <div style="display:flex; align-items:center; gap:8px;">
                <img src="${tread.photos[0]}" style="height:48px; width:48px; object-fit:cover; border-radius:4px; border:1px solid #ccc; cursor:pointer;" onclick="window.open('${tread.photos[0]}', '_blank')" title="Click to view full image" />
                <button type="button" onclick="window.removePhoto('${record.id}', ${idx})" style="background:#f44336; color:#fff; border:none; padding:4px 8px; border-radius:3px; font-size:10px; font-weight:bold; cursor:pointer;" title="Remove Photo">✕</button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    });

    html += `</div></div>`;
    mainPanel.innerHTML = html;
  }

  // GLOBAL ACTIONS
  window.deleteStaircase = function (recId) {
    if (confirm('Are you sure you want to delete this staircase record?')) {
      records = records.filter(r => r.id !== recId);
      if (activeRecordId === recId) {
        const remaining = records.filter(r => r.propertyId === currentPropertyId);
        activeRecordId = remaining.length ? remaining[0].id : null;
      }
      saveState();
      renderStaircaseList();
      renderRightPanel();
    }
  };

  window.clearAllStaircases = function () {
    if (confirm(`Are you sure you want to clear all test staircases for this property?`)) {
      records = records.filter(r => r.propertyId !== currentPropertyId);
      activeRecordId = null;
      saveState();
      renderStaircaseList();
      renderRightPanel();
    }
  };

  window.updateTreadStatus = function (recId, treadIdx, code) {
    const record = records.find(r => r.id === recId);
    if (!record) return;
    record.treads[treadIdx].condition = code;
    saveState();
    renderRightPanel();
  };

  window.handlePhotoUpload = function (recId, treadIdx, input) {
    if (!input.files || !input.files[0]) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      const record = records.find(r => r.id === recId);
      if (record) {
        record.treads[treadIdx].photos = [e.target.result];
        saveState();
        renderStaircaseList();
        renderRightPanel();
      }
    };
    reader.readAsDataURL(input.files[0]);
  };

  window.removePhoto = function (recId, treadIdx) {
    const record = records.find(r => r.id === recId);
    if (record) {
      record.treads[treadIdx].photos = [];
      saveState();
      renderStaircaseList();
      renderRightPanel();
    }
  };

  function init() {
    initPropertyDropdown();
    initStaircaseForm();
    renderStaircaseList();
    renderRightPanel();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
