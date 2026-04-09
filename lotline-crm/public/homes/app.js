let homes = [];
let activeType = "";
let activeBrand = "";
let savedHomes = new Set(JSON.parse(localStorage.getItem('savedHomes') || '[]'));

function toggleSave(id, btn) {
  event.stopPropagation();
  if (savedHomes.has(id)) {
    savedHomes.delete(id);
    btn.classList.remove('saved');
  } else {
    savedHomes.add(id);
    btn.classList.add('saved');
  }
  localStorage.setItem('savedHomes', JSON.stringify([...savedHomes]));
}

// ===== LOAD INVENTORY FROM homes.json =====
fetch('homes.json')
  .then(r => r.json())
  .then(data => {
    homes = data;
    renderHomes();
  })
  .catch(() => {
    document.getElementById('homesGrid').innerHTML =
      '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)">Could not load inventory. Please refresh.</div>';
  });

// ===== RENDER =====
function renderHomes() {
  const beds = document.getElementById('filterBeds').value;
  const maxPrice = document.getElementById('filterPrice').value;
  const sort = document.getElementById('filterSort').value;
  const typeFilter = document.getElementById('filterType').value;

  let list = homes.filter(h => {
    if (typeFilter && h.type !== typeFilter) return false;
    if (activeBrand && h.brand !== activeBrand) return false;
    const brandFilter = document.getElementById('filterBrand').value;
    if (brandFilter && h.brand !== brandFilter) return false;
    if (beds) {
      if (beds === '4' && h.beds < 4) return false;
      if (beds !== '4' && h.beds !== parseInt(beds)) return false;
    }
    if (maxPrice && h.price > 0 && h.price > parseInt(maxPrice)) return false;
    return true;
  });

  if (sort === 'price-asc') list.sort((a, b) => a.price - b.price);
  else if (sort === 'price-desc') list.sort((a, b) => b.price - a.price);
  else if (sort === 'sqft') list.sort((a, b) => b.sqft - a.sqft);

  const count = document.getElementById('resultsCount');
  count.textContent = `${list.length} home${list.length !== 1 ? 's' : ''} found`;

  const grid = document.getElementById('homesGrid');
  if (!list.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted)"><div style="font-size:48px;margin-bottom:16px">🔍</div><h3 style="margin-bottom:8px">No homes match your filters</h3><p>Try adjusting your search criteria above.</p></div>`;
    return;
  }

  grid.innerHTML = list.map(h => `
    <div class="home-card" onclick="openModal(${h.id})">
      <div class="home-card-img ${h.photos ? 'has-photo' : ''}" data-home-id="${h.id}" data-photo-idx="0">
        ${h.photos
          ? `<img src="${h.photos[0]}" alt="${h.name}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          : ''}
        <span style="${h.photos ? 'display:none' : ''}">${h.emoji}</span>
        ${h.badge ? `<span class="card-badge ${h.badgeClass}">${h.badge}</span>` : ''}
        <button class="card-save${savedHomes.has(h.id) ? ' saved' : ''}" onclick="toggleSave(${h.id}, this)">♥</button>
        ${h.photos && h.photos.length > 1 ? `
          <button class="card-photo-nav card-photo-prev" onclick="event.stopPropagation();cardPhotoNav(${h.id},-1)">&#8249;</button>
          <button class="card-photo-nav card-photo-next" onclick="event.stopPropagation();cardPhotoNav(${h.id},1)">&#8250;</button>
          <div class="card-photo-counter"><span class="card-photo-cur">1</span>/${h.photos.length}</div>
        ` : ''}
      </div>
      <div class="home-card-body">
        <div class="card-brand">${h.year} · ${h.brand}</div>
        <h3>${h.name}</h3>
        <div class="home-specs">
          <div class="spec-item">
            <span class="spec-val">${h.beds}</span>
            <span class="spec-lbl">Beds</span>
          </div>
          <div class="spec-item">
            <span class="spec-val">${h.baths}</span>
            <span class="spec-lbl">Baths</span>
          </div>
          <div class="spec-item">
            <span class="spec-val">${h.sqft.toLocaleString()}</span>
            <span class="spec-lbl">Sq Ft</span>
          </div>
          <div class="spec-item">
            <span class="spec-val">${h.type.charAt(0).toUpperCase() + h.type.slice(1)}</span>
            <span class="spec-lbl">Type</span>
          </div>
        </div>
        <div class="card-footer">
          <div>
            <div class="card-price">${h.price > 0 ? '$' + h.price.toLocaleString() : (h.priceLabel || 'Call for Price')}</div>
            <div class="card-price-note">${h.price > 0 ? 'includes delivery &amp; taxes' : 'contact us for pricing'}</div>
          </div>
          <button class="btn btn-red btn-card">View Details</button>
        </div>
      </div>
    </div>
  `).join('');
}

// ===== FILTER CHANGE =====
['filterType', 'filterBeds', 'filterPrice', 'filterSort'].forEach(id => {
  document.getElementById(id).addEventListener('change', renderHomes);
});
document.getElementById('filterBrand').addEventListener('change', function() {
  activeBrand = this.value;
  renderHomes();
});


// ===== ZIP FORM =====
document.getElementById('zipForm').addEventListener('submit', function(e) {
  e.preventDefault();
  document.getElementById('homes').scrollIntoView({ behavior: 'smooth' });
});

// ===== MODAL =====
function openModal(id) {
  const h = homes.find(x => x.id === id);
  if (!h) return;
  const photoGallery = h.photos ? `
    <div class="modal-gallery">
      <div class="gallery-main">
        <img id="galleryMain" src="${h.photos[0]}" alt="${h.name} photo 1">
        ${h.photos.length > 1 ? `
          <button class="gallery-nav gallery-prev" onclick="galleryNav(-1)">&#8249;</button>
          <button class="gallery-nav gallery-next" onclick="galleryNav(1)">&#8250;</button>
          <div class="gallery-counter"><span id="galleryIdx">1</span> / ${h.photos.length}</div>
        ` : ''}
      </div>
      ${h.photos.length > 1 ? `
        <div class="gallery-thumbs">
          ${h.photos.map((p, i) => `<img src="${p}" alt="photo ${i+1}" class="gallery-thumb ${i===0?'active':''}" onclick="gallerySet(${i})" loading="lazy">`).join('')}
        </div>
      ` : ''}
    </div>
  ` : `<div class="modal-hero">${h.emoji}</div>`;

  window._galleryPhotos = h.photos || [];
  window._galleryIndex = 0;

  document.getElementById('modalContent').innerHTML = photoGallery + `
    <div class="modal-body">
      <div class="modal-header">
        <div>
          <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:4px">${h.year} · ${h.brand}</div>
          <div class="modal-title">${h.name}</div>
        </div>
        <div>
          <div class="modal-price">${h.price > 0 ? '$' + h.price.toLocaleString() + ' <small>incl. delivery &amp; taxes</small>' : (h.priceLabel || 'Call for Price')}</div>
        </div>
      </div>
      <div class="modal-specs-grid">
        <div class="modal-spec"><strong>${h.beds}</strong><span>Bedrooms</span></div>
        <div class="modal-spec"><strong>${h.baths}</strong><span>Bathrooms</span></div>
        <div class="modal-spec"><strong>${h.sqft.toLocaleString()}</strong><span>Sq Ft</span></div>
        <div class="modal-spec"><strong>${h.type.charAt(0).toUpperCase() + h.type.slice(1)}</strong><span>Type</span></div>
        <div class="modal-spec"><strong>${h.year}</strong><span>Year</span></div>
        <div class="modal-spec"><strong>HUD ✓</strong><span>Certified</span></div>
      </div>
      <p class="modal-desc">${h.desc}</p>
      <div class="modal-features">
        ${h.features.map(f => `<span class="feature-pill">✓ ${f}</span>`).join('')}
      </div>
      <div class="modal-actions">
        <a href="#contact" class="btn btn-red btn-lg" onclick="closeModal()">Request Info</a>
        <a href="tel:+15551234567" class="btn btn-outline btn-lg">📞 Call Us</a>
      </div>
    </div>
  `;
  document.getElementById('modalBackdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function cardPhotoNav(homeId, dir) {
  const h = homes.find(x => x.id === homeId);
  if (!h || !h.photos) return;
  const imgWrap = document.querySelector(`.home-card-img[data-home-id="${homeId}"]`);
  if (!imgWrap) return;
  let idx = (parseInt(imgWrap.dataset.photoIdx) + dir + h.photos.length) % h.photos.length;
  imgWrap.dataset.photoIdx = idx;
  const img = imgWrap.querySelector('img');
  if (img) { img.style.display = ''; img.src = h.photos[idx]; }
  const cur = imgWrap.querySelector('.card-photo-cur');
  if (cur) cur.textContent = idx + 1;
}

function gallerySet(i) {
  const photos = window._galleryPhotos;
  if (!photos.length) return;
  window._galleryIndex = (i + photos.length) % photos.length;
  document.getElementById('galleryMain').src = photos[window._galleryIndex];
  document.getElementById('galleryIdx').textContent = window._galleryIndex + 1;
  document.querySelectorAll('.gallery-thumb').forEach((t, idx) => t.classList.toggle('active', idx === window._galleryIndex));
}
function galleryNav(dir) { gallerySet(window._galleryIndex + dir); }

function closeModal() {
  document.getElementById('modalBackdrop').classList.remove('open');
  document.body.style.overflow = '';
}
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalBackdrop').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// ===== CALCULATOR =====
function calcPayment() {
  const price = parseFloat(document.getElementById('calcPrice').value);
  const down = parseFloat(document.getElementById('calcDown').value) || 0;
  const term = parseInt(document.getElementById('calcTerm').value);
  const rate = parseFloat(document.getElementById('calcRate').value);
  const result = document.getElementById('calcResult');
  const amount = document.getElementById('calcAmount');

  if (!price || !rate) {
    amount.textContent = 'Enter price & rate';
    result.classList.add('visible');
    return;
  }
  const principal = price - down;
  const r = rate / 100 / 12;
  const n = term * 12;
  const payment = principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  amount.textContent = '$' + payment.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '/mo';
  result.classList.add('visible');
}

// ===== FAQ =====
function toggleFaq(btn) {
  const answer = btn.nextElementSibling;
  const isOpen = btn.classList.contains('open');
  // close all
  document.querySelectorAll('.faq-question.open').forEach(b => {
    b.classList.remove('open');
    b.nextElementSibling.classList.remove('open');
  });
  if (!isOpen) {
    btn.classList.add('open');
    answer.classList.add('open');
  }
}

// ===== CONTACT FORM =====
document.getElementById('contactForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const form = this;
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Sending…';
  try {
    const res = await fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { 'Accept': 'application/json' }
    });
    if (res.ok) {
      document.getElementById('formSuccess').classList.add('visible');
      form.reset();
      setTimeout(() => document.getElementById('formSuccess').classList.remove('visible'), 5000);
    } else {
      alert('Something went wrong. Please try again or call us directly.');
    }
  } catch {
    alert('Could not send message. Please check your connection and try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send Message';
  }
});

// ===== HAMBURGER =====
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('navLinks').classList.toggle('mobile-open');
});

// homes loaded via fetch above
