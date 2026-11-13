"use client";

import { useRef, useState, type DragEvent } from "react";

export interface DraftPhotoView {
  id: string;
  file: File;
  url: string;
}

export function PhotoField({
  photos,
  onFiles,
  onRemove,
  error,
  max = 3,
}: {
  photos: DraftPhotoView[];
  onFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  error?: string;
  max?: number;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const full = photos.length >= max;

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  };

  return (
    <div className="photo-picker">
      {photos.length > 0 ? (
        <div className="photo-thumbs">
          {photos.map((photo) => (
            <div className="photo-thumb" key={photo.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={`Выбранное фото: ${photo.file.name}`} />
              <button
                type="button"
                className="photo-thumb__remove"
                onClick={() => onRemove(photo.id)}
                aria-label={`Удалить фото ${photo.file.name}`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
              <span className="photo-thumb__name">{photo.file.name}</span>
            </div>
          ))}
        </div>
      ) : null}

      {!full ? (
        <label
          className={`photo-drop${dragging ? " is-over" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (files.length > 0) onFiles(files);
              event.target.value = "";
            }}
            aria-describedby="photo-hint"
            data-testid="photo-input"
          />
          <span className="photo-drop__icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4M7 9l5-5 5 5" />
              <path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
            </svg>
          </span>
          <strong>{photos.length > 0 ? "Добавить ещё фото" : "Приложить фото"}</strong>
          <span id="photo-hint">
            JPEG, PNG или WebP · до 8 МБ · {photos.length} из {max}
          </span>
        </label>
      ) : (
        <p className="field__hint">Достигнут лимит: {max} фото. Удалите лишнее, чтобы заменить.</p>
      )}

      <p className="field__hint">
        Фото видит только владелец по приватной ссылке. Черновик фото хранится в этом
        браузере и удаляется после отправки.
      </p>
      {error ? <p className="field__error">{error}</p> : null}
    </div>
  );
}
