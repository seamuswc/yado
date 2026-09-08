"use client";

import { useActionState, useState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { amenityKeys, cities, typeLabel, type AmenityKey } from "@/lib/hotels-shared";
import type { ActionState } from "@/actions/auth";
import SubmitButton from "./SubmitButton";

import { emptyRoom, type ListingDraft, type RoomDraft } from "@/lib/listing-draft";

type Props = {
  locale: Locale; dict: Dictionary; initial: ListingDraft; mode: "register" | "edit";
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  translationAvailable: boolean;
};

export default function ListingForm({ locale, dict, initial, mode, action, translationAvailable }: Props) {
  const [state, formAction] = useActionState(action, {});
  const [rooms, setRooms] = useState<(RoomDraft & { key: string })[]>(() => (initial.rooms.length ? initial.rooms : [{ ...emptyRoom }]).map((r, i) => ({ ...r, key: r.id ?? `init-${i}` })));
  const P = dict.partner;
  const field = "w-full rounded-xl border border-line bg-card px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-primary/40";
  const small = "w-full rounded-lg border border-line bg-card px-2 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary/40";
  const label = "block text-xs font-medium text-muted mb-1";
  const showEn = mode === "edit";

  if (state.ok && mode === "register") {
    return (
      <div className="rounded-2xl bg-card border border-line p-6 text-center">
        <p className="text-4xl mb-2">📨</p>
        <h2 className="font-semibold text-lg">{P.registeredTitle}</h2>
        <p className="text-sm text-muted mt-2">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="locale" value={locale} />
      {initial.hotelId && <input type="hidden" name="hotelId" value={initial.hotelId} />}
      {/* Honeypot: real users never see or fill this. */}
      <div className="hidden" aria-hidden><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>

      {mode === "register" && (
        <section className="space-y-3">
          <h2 className="font-semibold">{P.contactName} / {P.email}</h2>
          <div><label className={label} htmlFor="contactName">{P.contactName}</label><input id="contactName" name="contactName" required className={field} autoComplete="name" /></div>
          <div><label className={label} htmlFor="email">{P.email}</label><input id="email" name="email" type="email" required className={field} autoComplete="email" /></div>
          <div><label className={label} htmlFor="password">{P.password}</label><input id="password" name="password" type="password" required minLength={10} className={field} autoComplete="new-password" /><p className="text-xs text-muted mt-1">{P.passwordHint}</p></div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">{P.registerTitle} · {P.japaneseFields}</h2>
        <div><label className={label} htmlFor="nameJa">{P.propertyName}</label><input id="nameJa" name="nameJa" required defaultValue={initial.nameJa} className={field} lang="ja" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={label} htmlFor="type">{P.type}</label>
            <select id="type" name="type" defaultValue={initial.type} className={field}>
              {(Object.keys(typeLabel) as (keyof typeof typeLabel)[]).map((k) => <option key={k} value={k}>{typeLabel[k][locale]}</option>)}
            </select></div>
          <div><label className={label} htmlFor="city">{P.city}</label>
            <select id="city" name="city" defaultValue={initial.city} className={field}>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name[locale]}</option>)}
            </select></div>
        </div>
        <div><label className={label} htmlFor="address">{P.address}</label><input id="address" name="address" required defaultValue={initial.address} className={field} lang="ja" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={label} htmlFor="phone">{P.phone}</label><input id="phone" name="phone" type="tel" required defaultValue={initial.phone} className={field} /></div>
          <div><label className={label} htmlFor="licenseNumber">{P.license}</label><input id="licenseNumber" name="licenseNumber" required defaultValue={initial.licenseNumber} className={field} /></div>
        </div>
        <p className="text-xs text-muted -mt-1">{P.licenseHint}</p>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={label} htmlFor="stationJa">{P.station}</label><input id="stationJa" name="stationJa" defaultValue={initial.stationJa} className={field} lang="ja" placeholder="新宿駅" /></div>
          <div><label className={label} htmlFor="areaJa">{P.area}</label><input id="areaJa" name="areaJa" defaultValue={initial.areaJa} className={field} lang="ja" placeholder="駅から徒歩5分" /></div>
        </div>
        <div><label className={label} htmlFor="descriptionJa">{P.description}</label><textarea id="descriptionJa" name="descriptionJa" required minLength={10} rows={5} defaultValue={initial.descriptionJa} className={field} lang="ja" /></div>
        <div><label className={label} htmlFor="accessJa">{P.access}</label><textarea id="accessJa" name="accessJa" rows={2} defaultValue={initial.accessJa} className={field} lang="ja" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={label} htmlFor="checkInTime">{P.checkInTime}</label><input id="checkInTime" name="checkInTime" type="time" defaultValue={initial.checkInTime} className={field} /></div>
          <div><label className={label} htmlFor="checkOutTime">{P.checkOutTime}</label><input id="checkOutTime" name="checkOutTime" type="time" defaultValue={initial.checkOutTime} className={field} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={label} htmlFor="latitude">{P.latitude}</label><input id="latitude" name="latitude" type="number" step="any" defaultValue={initial.latitude ?? ""} className={field} placeholder="35.6917" /></div>
          <div><label className={label} htmlFor="longitude">{P.longitude}</label><input id="longitude" name="longitude" type="number" step="any" defaultValue={initial.longitude ?? ""} className={field} placeholder="139.7036" /></div>
        </div>
        <p className="text-xs text-muted -mt-1">{P.coordsHint}</p>
        <fieldset>
          <legend className={label}>{P.amenities}</legend>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
            {amenityKeys.map((a: AmenityKey) => (
              <label key={a} className="flex items-center gap-2"><input type="checkbox" name="amenities" value={a} defaultChecked={initial.amenities.includes(a)} className="h-4 w-4 accent-primary" />{dict.amenities[a]}</label>
            ))}
          </div>
        </fieldset>
        <div><label className={label} htmlFor="images">{P.images}</label><textarea id="images" name="images" rows={3} defaultValue={initial.images.join("\n")} className={`${field} font-mono`} placeholder="https://…" /><p className="text-xs text-muted mt-1">{P.imagesHint}</p></div>
      </section>

      {showEn && (
        <section className="space-y-3">
          <h2 className="font-semibold">{P.englishFields}</h2>
          <p className={`text-xs rounded-lg px-3 py-2 ${initial.translation === "pending" ? "bg-amber-50 text-amber-800" : "bg-paper text-muted"}`}>
            {initial.translation === "machine" ? P.translationMachine : initial.translation === "manual" ? P.translationManual : P.translationPending}
          </p>
          <div><label className={label} htmlFor="nameEn">{P.propertyName} (EN)</label><input id="nameEn" name="nameEn" defaultValue={initial.nameEn ?? ""} className={field} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={label} htmlFor="stationEn">{P.station} (EN)</label><input id="stationEn" name="stationEn" defaultValue={initial.stationEn ?? ""} className={field} /></div>
            <div><label className={label} htmlFor="areaEn">{P.area} (EN)</label><input id="areaEn" name="areaEn" defaultValue={initial.areaEn ?? ""} className={field} /></div>
          </div>
          <div><label className={label} htmlFor="descriptionEn">{P.description} (EN)</label><textarea id="descriptionEn" name="descriptionEn" rows={5} defaultValue={initial.descriptionEn ?? ""} className={field} /></div>
          <div><label className={label} htmlFor="accessEn">{P.access} (EN)</label><textarea id="accessEn" name="accessEn" rows={2} defaultValue={initial.accessEn ?? ""} className={field} /></div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">{P.rooms}</h2>
        {rooms.map((r, i) => (
          <div key={r.key} className="rounded-2xl bg-card border border-line p-3 space-y-2">
            {r.id && <input type="hidden" name={`rooms[${i}][id]`} value={r.id} />}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted">#{i + 1}</span>
              {rooms.length > 1 && <button type="button" onClick={() => setRooms(rooms.filter((_, j) => j !== i))} className="text-xs text-red-700 px-3 py-2 -mr-3 rounded-lg">{P.removeRoom}</button>}
            </div>
            <div><label className={label} htmlFor={`room-${r.key}-nameJa`}>{P.roomName}</label><input id={`room-${r.key}-nameJa`} name={`rooms[${i}][nameJa]`} required defaultValue={r.nameJa} className={small} lang="ja" /></div>
            <div><label className={label} htmlFor={`room-${r.key}-descriptionJa`}>{P.roomDescription}</label><input id={`room-${r.key}-descriptionJa`} name={`rooms[${i}][descriptionJa]`} defaultValue={r.descriptionJa} className={small} lang="ja" /></div>
            {showEn && (
              <div className="grid grid-cols-2 gap-2">
                <div><label className={label} htmlFor={`room-${r.key}-nameEn`}>{P.roomName} (EN)</label><input id={`room-${r.key}-nameEn`} name={`rooms[${i}][nameEn]`} defaultValue={r.nameEn ?? ""} className={small} /></div>
                <div><label className={label} htmlFor={`room-${r.key}-descriptionEn`}>{P.roomDescription} (EN)</label><input id={`room-${r.key}-descriptionEn`} name={`rooms[${i}][descriptionEn]`} defaultValue={r.descriptionEn ?? ""} className={small} /></div>
              </div>
            )}
            <div className="grid grid-cols-4 gap-2">
              <div><label className={label} htmlFor={`room-${r.key}-sleeps`}>{P.sleeps}</label><input id={`room-${r.key}-sleeps`} name={`rooms[${i}][sleeps]`} type="number" min={1} max={12} required defaultValue={r.sleeps} className={small} /></div>
              <div><label className={label} htmlFor={`room-${r.key}-sizeSqm`}>{P.sizeSqm}</label><input id={`room-${r.key}-sizeSqm`} name={`rooms[${i}][sizeSqm]`} type="number" min={0} defaultValue={r.sizeSqm ?? ""} className={small} /></div>
              <div><label className={label} htmlFor={`room-${r.key}-quantity`}>{P.quantity}</label><input id={`room-${r.key}-quantity`} name={`rooms[${i}][quantity]`} type="number" min={1} required defaultValue={r.quantity} className={small} /></div>
              <div><label className={label} htmlFor={`room-${r.key}-pricePerNight`}>{P.price}</label><input id={`room-${r.key}-pricePerNight`} name={`rooms[${i}][pricePerNight]`} type="number" min={500} step={100} required defaultValue={r.pricePerNight} className={small} /></div>
            </div>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" name={`rooms[${i}][breakfast]`} defaultChecked={r.breakfast} className="h-4 w-4 accent-primary" />{P.breakfast}</label>
              <label className="flex items-center gap-2"><input type="checkbox" name={`rooms[${i}][refundable]`} defaultChecked={r.refundable} className="h-4 w-4 accent-primary" />{P.refundable}</label>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setRooms([...rooms, { ...emptyRoom, key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }])} className="w-full rounded-xl border border-dashed border-line py-2 text-sm text-primary">+ {P.addRoom}</button>
      </section>

      {mode === "register" && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="agree" required className="mt-1 h-4 w-4 accent-primary" />
          <span>{P.agree}</span>
        </label>
      )}

      {state.error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{state.error}</p>}
      {state.ok && state.message && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">{state.message}</p>}

      <div className="space-y-2">
        <SubmitButton className="w-full">{mode === "register" ? P.submit : P.save}</SubmitButton>
        {showEn && translationAvailable && (
          <SubmitButton secondary className="w-full" name="retranslate" value="1">🔁 {P.retranslate}</SubmitButton>
        )}
      </div>
    </form>
  );
}
