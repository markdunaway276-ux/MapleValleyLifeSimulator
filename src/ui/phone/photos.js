const PHOTO_KEY = 'mapleValleyLife_phonePhotos';
const MAX_PHOTOS = 12;
const JPEG_DATA = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/;

export const CAMERA_FILTERS = Object.freeze([
  { id: 'none', label: 'Natural', css: 'none' },
  { id: 'warm', label: 'Warm Film', css: 'sepia(0.24) saturate(1.18) contrast(1.06)' },
  { id: 'golden', label: 'Golden', css: 'sepia(0.18) saturate(1.28) brightness(1.05) contrast(1.04)' },
  { id: 'bw', label: 'Cozy B&W', css: 'grayscale(1) contrast(1.16) brightness(1.02)' }
]);

export function readPhotos(storage) {
  try {
    const photos = JSON.parse(storage.getItem(PHOTO_KEY));
    return Array.isArray(photos) ? photos.filter(photo => photo && typeof photo.id === 'string'
      && typeof photo.image === 'string' && JPEG_DATA.test(photo.image)).slice(0, MAX_PHOTOS) : [];
  } catch {
    return [];
  }
}

export function createPhotoLibrary(storage) {
  let photos = readPhotos(storage);

  function write(next) {
    try {
      storage.setItem(PHOTO_KEY, JSON.stringify(next));
      photos = next;
      return true;
    } catch {
      return false;
    }
  }

  return {
    list: () => photos,
    add(image, meta = null) {
      if (typeof image !== 'string' || !JPEG_DATA.test(image)) return false;
      if (photos.length >= MAX_PHOTOS) return false;
      const entry = {
        id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()),
        image
      };
      if (meta && typeof meta === 'object') {
        if (typeof meta.zoom === 'number') entry.zoom = meta.zoom;
        if (typeof meta.filterId === 'string') entry.filterId = meta.filterId;
        if (typeof meta.hour === 'number') entry.hour = meta.hour;
        if (typeof meta.zone === 'string') entry.zone = meta.zone;
      }
      return write([entry, ...photos]);
    },
    remove(id) {
      return write(photos.filter(photo => photo.id !== id));
    },
    limit: MAX_PHOTOS
  };
}

function button(label, action) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'phone-task-pin';
  el.textContent = label;
  el.addEventListener('click', action);
  return el;
}

function heading(text) {
  const title = document.createElement('h3');
  title.className = 'phone-app-title';
  title.textContent = text;
  return title;
}

export const CAMERA_APP = {
  id: 'camera',
  name: 'Camera',
  icon: '📷',
  render(screen, ctx) {
    const preview = document.createElement('img');
    preview.className = 'phone-viewfinder';
    preview.alt = 'Camera viewfinder';
    preview.draggable = false;
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    const aim = { yaw: 0, pitch: 0, zoom: 1, filter: 'none' };
    let filterIdx = 0;
    let drag = null;

    function frame() {
      try {
        const image = ctx.capturePhoto?.(aim);
        if (!image?.startsWith('data:image/jpeg;base64,')) throw new Error('Image unavailable');
        preview.src = image;
        return image;
      } catch {
        status.textContent = 'Camera preview unavailable.';
        return null;
      }
    }

    preview.addEventListener('pointerdown', event => {
      if (event.button !== 0 || drag) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      preview.setPointerCapture?.(event.pointerId);
    });
    preview.addEventListener('pointerup', event => {
      if (!drag || drag.id !== event.pointerId) return;
      aim.yaw = Math.max(-1.4, Math.min(1.4, aim.yaw - (event.clientX - drag.x) * 0.007));
      aim.pitch = Math.max(-0.8, Math.min(0.8, aim.pitch - (event.clientY - drag.y) * 0.007));
      drag = null;
      frame();
    });
    preview.addEventListener('pointercancel', () => { drag = null; });

    // Zoom & film filter toolbar
    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;gap:5px;flex-wrap:wrap;margin:6px 0;';
    const zoomBtn = button('Zoom: 1×', () => {
      const levels = [1, 1.5, 2];
      const next = levels[(levels.indexOf(aim.zoom) + 1) % levels.length];
      aim.zoom = next;
      zoomBtn.textContent = `Zoom: ${next}×`;
      frame();
    });
    const filterBtn = button('Filter: Natural', () => {
      filterIdx = (filterIdx + 1) % CAMERA_FILTERS.length;
      const f = CAMERA_FILTERS[filterIdx];
      aim.filter = f.css;
      filterBtn.textContent = `Filter: ${f.label}`;
      frame();
    });
    const resetBtn = button('Center', () => {
      aim.yaw = 0;
      aim.pitch = 0;
      frame();
    });
    controls.append(zoomBtn, filterBtn, resetBtn);

    const take = button('Take photo', () => {
      if (ctx.photos.list().length >= ctx.photos.limit) {
        status.textContent = 'Gallery full. Delete a photo to make room.';
        return;
      }
      const image = frame();
      if (!image) return;
      const extra = typeof ctx.getPhotoContext === 'function' ? ctx.getPhotoContext() : {};
      const meta = {
        zoom: aim.zoom,
        filterId: CAMERA_FILTERS[filterIdx]?.id || 'none',
        ...(extra && typeof extra === 'object' ? extra : {})
      };
      status.textContent = ctx.photos.add(image, meta)
        ? `Saved (${ctx.photos.list().length}/${ctx.photos.limit}) to Gallery.`
        : 'Could not save the photo in this browser.';
    });
    screen.append(heading('Camera'), preview, controls, take, button(`Gallery (${ctx.photos.list().length}/${ctx.photos.limit})`, () => ctx.openApp('gallery')), status);
    frame();
  }
};

export const GALLERY_APP = {
  id: 'gallery',
  name: 'Gallery',
  icon: '🖼️',
  render(screen, ctx) {
    const content = document.createElement('div');
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    screen.append(heading('Gallery'), content, status);

    function list() {
      content.replaceChildren();
      const photos = ctx.photos.list();
      if (!photos.length) {
        content.append(button('Open Camera', () => ctx.openApp('camera')));
        return;
      }
      const grid = document.createElement('div');
      grid.className = 'phone-photo-grid';
      photos.forEach((photo, index) => {
        const item = button('', () => detail(photo));
        item.setAttribute('aria-label', 'View photo ' + (index + 1));
        const image = document.createElement('img');
        image.alt = '';
        image.src = photo.image;
        item.append(image);
        grid.append(item);
      });
      content.append(grid);
    }

    function detail(photo) {
      status.textContent = '';
      content.replaceChildren();
      const image = document.createElement('img');
      image.className = 'phone-viewfinder';
      image.alt = 'Saved Maple Lane photo';
      image.src = photo.image;
      const actions = [
        button('Use as wallpaper', () => {
          status.textContent = ctx.setPhonePrefs({ wallpaper: 'photo', photoId: photo.id })
            ? 'Wallpaper changed.' : 'Could not save this wallpaper.';
        })
      ];
      if (typeof ctx.hangPhoto === 'function') {
        actions.push(button('Hang at home', () => {
          const res = ctx.hangPhoto(photo.id);
          status.textContent = res ? `Hung in ${res.label} frame!` : 'Could not hang photo.';
        }));
      }
      actions.push(
        button('All photos', list),
        button('Delete photo', () => {
          if (!ctx.photos.remove(photo.id)) {
            status.textContent = 'Could not delete the photo.';
            return;
          }
          if (ctx.getPhonePrefs().photoId === photo.id) ctx.setPhonePrefs({ wallpaper: 'coast', photoId: null });
          status.textContent = 'Photo deleted.';
          list();
        })
      );
      content.append(image, ...actions);
    }
    list();
  }
};
