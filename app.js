// Complete Client-Side App Logic (Zero Backend Required)
(function () {
  const STORAGE_KEY_PROPERTIES = 'vw_stair_properties';
  const STORAGE_KEY_RECORDS = 'vw_stair_records';

  let properties = JSON.parse(localStorage.getItem(STORAGE_KEY_PROPERTIES)) || [
    { id: 'spanish-palms', name: 'Spanish Palms' }
  ];
  let records = JSON.parse(localStorage.getItem(STORAGE_KEY_RECORDS)) || [];
  let currentPropertyId = properties[0]?.id || 'spanish-palms';
  let activeRecordId = null;

  function saveState() {
    localStorage.setItem(STORAGE_KEY_PROPERTIES, JSON.stringify(properties));
    localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records));
  }

  function getElementByText(selector, text) {
    const elements = Array.from(document.querySelectorAll(selector));
    return elements.find(el => el.textContent.trim().toLowerCase().includes(text.toLowerCase()));
  }

  // 1. PROPERTY DROPDOWN & ADD PROPERTY
  function initPropertyDropdown() {
    const select = document.querySelector('select');
    if (!select) return;

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
      activeRecordId = null;
      renderStaircaseList();
      renderRightPanel();
    };

    const addPropBtn = getElementByText('button', 'add property');
    if (addPropBtn) {
      addPropBtn.onclick = (e) => {
        e.preventDefault();
        const propName = prompt('Enter new Property Name:');
        if (propName && propName.trim()) {
          const name = propName.trim();
          const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          if (!properties.some(p => p.id === id)) {
            properties.push({ id, name });
            currentPropertyId = id;
            saveState();
            initPropertyDropdown();
            renderStaircaseList();
            renderRightPanel();
          }
        }
      };
    }
  }

  // 2. CREATE STAIRCASE RECORD
  function initStaircaseForm() {
    const createBtn = getElementByText('button', 'create staircase record');
    if (!createBtn) return;

    createBtn.onclick = (e) => {
      e.preventDefault();

      const inputs = Array.from(document.querySelectorAll('input, textarea'));
      const getVal = (term) => {
        const found = inputs.find(i => {
          const p = i.closest('label') || i.parentElement;
          return p && p.textContent.toLowerCase().includes(term);
        });
        return found ? found.value : '';
      };

      const building = getVal('building') || 'Building B';
      const unit = getVal('unit') || 'Unit 204';
      const periodLabel = getVal('period') || 'Summer 2026 cycle';
      const inspectedOn = getVal('inspected') || new Date().toISOString().split('T')[0];
      const inspector = getVal('inspector') || 'R. Okonkwo';
      const stepCount = parseInt(getVal('treads') || '17', 10);

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
        treads
      };

      records.push(newRecord);
      activeRecordId = newRecord.id;
      saveState();

      renderStaircaseList();
      renderRightPanel();
    };
  }

  function renderStaircaseList() {
    const sidebar = document.querySelector('.staircases, #staircases') || 
                    getElementByText('h4', 'staircases')?.parentElement;
    if (!sidebar) return;

    let listContainer = sidebar.querySelector('.custom-staircase-items');
    if (!listContainer) {
      listContainer = document.createElement('div');
      listContainer.className = 'custom-staircase-items';
      listContainer.style.marginTop = '15px';
      sidebar.appendChild(listContainer);
    }

    const propRecords = records.filter(r => r.propertyId === currentPropertyId);

    if (propRecords.length === 0) {
      listContainer.innerHTML = '<p style="font-size:12px; opacity:0.7; margin-top:10px;">No staircases logged for this property yet.</p>';
      return;
    }

    listContainer.innerHTML = propRecords.map(r => `
      <div class="stair-item ${r.id === activeRecordId ? 'active' : ''}" 
           data-id="${r.id}"
           style="padding:10px; margin-bottom:8px; border:1px solid ${r.id === activeRecordId ? '#ff5722' : '#ccc'}; background:${r.id === activeRecordId ? '#fff3e0' : '#f9f9f9'}; cursor:pointer; border-radius:4px;">
        <strong>${r.building} - ${r.unit}</strong><br>
        <small>${r.periodLabel} | ${r.treads.length} Steps</small>
      </div>
    `).join('');

    listContainer.querySelectorAll('.stair-item').forEach(item => {
      item.onclick = () => {
        activeRecordId = item.getAttribute('data-id');
        renderStaircaseList();
        renderRightPanel();
      };
    });
  }

  // 3. RIGHT PANEL (TREAD GRID)
  function renderRightPanel() {
    const mainPanel = getElementByText('h4', 'no staircase selected')?.parentElement || 
                      document.querySelectorAll('.main-panel, #mainPanel')[0] ||
                      document.querySelectorAll('div')[2];

    if (!mainPanel) return;

    const record = records.find(r => r.id === activeRecordId);

    if (!record) {
      mainPanel.innerHTML = `
        <h4>NO STAIRCASE SELECTED</h4>
        <p style="opacity:0.8;">Pick a staircase from the left list, or log a new one.</p>
        <div style="text-align:center; padding:40px; color:#888;">
          <p>Every tread is recorded, not just the damaged ones. Photos attach to the treads you flag.</p>
        </div>
      `;
      return;
    }

    let html = `
      <div style="margin-bottom:20px; padding-bottom:10px; border-bottom:2px solid #ff5722;">
        <h3 style="margin:0;">${record.building} — ${record.unit}</h3>
        <p style="font-size:13px; color:#555; margin-top:5px;">Inspector: <strong>${record.inspector}</strong> | Period: <strong>${record.periodLabel}</strong> | Date: ${record.inspectedOn}</p>
      </div>
      <div class="tread-grid" style="display:flex; flex-direction:column; gap:10px;">
    `;

    record.treads.forEach((tread, idx) => {
      const isFlagged = ['C', 'HSW'].includes(tread.condition);
      html += `
        <div style="padding:10px; border:1px solid ${isFlagged ? '#e53935' : '#ddd'}; background:${isFlagged ? '#ffebee' : '#fff'}; border-radius:4px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong>Step ${tread.step}</strong>
            <div style="display:flex; gap:5px;">
              ${['PASS', 'C', 'N', 'MON', 'HSW'].map(code => `
                <button type="button" 
                        onclick="window.updateTreadStatus('${record.id}', ${idx}, '${code}')"
                        style="padding:4px 8px; font-size:11px; border-radius:3px; border:1px solid #ccc; cursor:pointer; background:${tread.condition === code ? '#333' : '#fff'}; color:${tread.condition === code ? '#fff' : '#333'}; font-weight:bold;">
                  ${code}
                </button>
              `).join('')}
            </div>
          </div>
          ${isFlagged ? `
            <div style="margin-top:8px; display:flex; gap:10px; align-items:center;">
              <input type="file" accept="image/*" onchange="window.handlePhotoUpload('${record.id}', ${idx}, this)" style="font-size:11px;" />
              ${tread.photos && tread.photos.length ? `<img src="${tread.photos[0]}" style="height:35px; border-radius:3px; border:1px solid #ccc;" />` : ''}
            </div>
          ` : ''}
        </div>
      `;
    });

    html += `</div>`;
    mainPanel.innerHTML = html;
  }

  // 4. GLOBAL TREAD HANDLERS
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
        renderRightPanel();
      }
    };
    reader.readAsDataURL(input.files[0]);
  };

  // 5. PDF REPORT
  function initReportGenerator() {
    const pdfBtn = getElementByText('button', 'generate pdf');
    if (pdfBtn) {
      pdfBtn.onclick = (e) => {
        e.preventDefault();
        window.print();
      };
    }
  }

  function init() {
    initPropertyDropdown();
    initStaircaseForm();
    renderStaircaseList();
    renderRightPanel();
    initReportGenerator();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
