import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Leaf, Wheat, Cherry, Flame, Flower2, Sprout,
  AlertTriangle, Clock, RefreshCw, Thermometer, Droplets, Wind, Sun as SunIcon, Beaker,
  ChevronDown, ChevronUp, Terminal, Moon, Sun
} from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts'

// ─── CROPS ────────────────────────────────────────────────────────────────────
// medium: 'hydro' | 'soil'
const CROPS = [
  // Hydroponic
  { id: 'lettuce',    name: 'Салат',                  en: 'Lettuce',           medium: 'hydro', Icon: Leaf,    color: '#2e7d52', optimalPh: [6.0, 7.0], optimalTemp: [16, 22] },
  { id: 'spinach',    name: 'Шпинат',                 en: 'Spinach',           medium: 'hydro', Icon: Leaf,    color: '#267060', optimalPh: [6.0, 7.5], optimalTemp: [15, 20] },
  // Soil
  { id: 'strawberry', name: 'Полуниця',               en: 'Strawberry',        medium: 'soil',  Icon: Cherry,  color: '#c0455a', optimalPh: [5.5, 6.5], optimalTemp: [18, 24] },
  { id: 'wheat',      name: 'Пшениця',                en: 'Wheat',             medium: 'soil',  Icon: Wheat,   color: '#a07828', optimalPh: [6.0, 7.0], optimalTemp: [15, 22] },
  { id: 'tomato',     name: 'Томат',                  en: 'Tomato',            medium: 'soil',  Icon: Sprout,  color: '#b53a3a', optimalPh: [5.5, 6.5], optimalTemp: [20, 26] },
  { id: 'pepper',     name: 'Перець декоративний',    en: 'Decorative Pepper', medium: 'soil',  Icon: Flame,   color: '#b86030', optimalPh: [5.5, 6.8], optimalTemp: [21, 28] },
  { id: 'hosta',      name: 'Хоста мінія',            en: 'Hosta',             medium: 'soil',  Icon: Flower2, color: '#6a58a8', optimalPh: [6.0, 7.5], optimalTemp: [14, 22] },
]

// ─── SENSOR ENGINE ────────────────────────────────────────────────────────────
class SensorNode {
  constructor(init, min, max, noise, dec = 2) {
    this.v = init; this.min = min; this.max = max
    this.noise = noise; this.dec = dec
    this.trend = 0; this.ttl = 0
    this.hist = Array(40).fill(init)
  }
  tick() {
    if (--this.ttl <= 0) {
      this.trend = (Math.random() - 0.5) * this.noise * 0.5
      this.ttl = 12 + Math.floor(Math.random() * 30)
    }
    const mid = (this.max + this.min) / 2
    this.v += (mid - this.v) * 0.003 + (Math.random() - 0.5) * this.noise + this.trend
    this.v = Math.max(this.min, Math.min(this.max, this.v))
    this.hist.push(+this.v.toFixed(this.dec))
    if (this.hist.length > 40) this.hist.shift()
    return +this.v.toFixed(this.dec)
  }
  get() { return +this.v.toFixed(this.dec) }
  histData() { return this.hist.map((v, i) => ({ t: i, v })) }
}

function buildSensors() {
  return {
    room: {
      temp: new SensorNode(22.5, 18, 28, 0.08, 1),
      hum:  new SensorNode(62,   45, 80, 0.5,  1),
      co2:  new SensorNode(820,  400, 1400, 8,  0),
      lux:  new SensorNode(4200, 1000, 8000, 60, 0),
    },
    nft: {
      wt:  new SensorNode(21.0, 18, 26, 0.06, 1),
      ph:  new SensorNode(6.2,  5.5, 7.5, 0.015, 2),
      do_: new SensorNode(7.8,  4, 12, 0.05, 1),
      ec:  new SensorNode(1.3,  0.5, 3.0, 0.02, 2),
      lv:  new SensorNode(78,   78, 78,  0,   1),
      no3: new SensorNode(150,  80, 250, 1.5, 0),
    },
    dwc: {
      wt:  new SensorNode(20.5, 18, 26, 0.06, 1),
      ph:  new SensorNode(5.9,  5.5, 7.5, 0.015, 2),
      do_: new SensorNode(8.4,  4, 12, 0.05, 1),
      ec:  new SensorNode(2.1,  0.5, 3.5, 0.02, 2),
      lv:  new SensorNode(65,   65, 65,  0,   1),
      no3: new SensorNode(160,  80, 250, 1.5, 0),
    },
    crops: CROPS.map(c => ({
      id: c.id,
      moist: new SensorNode(65 + (Math.random() - 0.5) * 20, 30, 82, 0.6, 1),
      temp:  new SensorNode(
        c.optimalTemp[0] + (c.optimalTemp[1] - c.optimalTemp[0]) * 0.5 + (Math.random() - 0.5) * 3,
        c.optimalTemp[0] - 5, c.optimalTemp[1] + 5, 0.04, 1
      ),
      lum:  new SensorNode(3200 + Math.random() * 1800, 500, 7000, 50, 0),
      fert: new SensorNode(1.4 + Math.random() * 0.8, 0.2, 3.5, 0.02, 2),
    })),
  }
}

// ─── STATUS HELPERS ───────────────────────────────────────────────────────────
const phStatus  = v => v < 5.4 || v > 7.6 ? 'crit' : v < 5.8 || v > 7.2 ? 'warn' : 'ok'
const no3Status = v => v > 240 ? 'crit' : v > 220 ? 'warn' : 'ok'
const doStatus  = v => v < 4.5 ? 'crit' : v < 6.0 ? 'warn' : 'ok'
const lvStatus  = v => v < 25 ? 'crit' : v < 40 ? 'warn' : 'ok'
const moistStatus = v => v < 35 || v > 90 ? 'warn' : 'ok'

const valCls = s =>
  s === 'crit' ? 'text-red-600 dark:text-red-400' :
  s === 'warn' ? 'text-amber-600 dark:text-amber-400' :
  'text-stone-800 dark:text-stone-100'

const dotCls = s =>
  s === 'crit' ? 'bg-red-500' :
  s === 'warn' ? 'bg-amber-400' :
  'bg-emerald-500'

// ─── SPARKLINE ────────────────────────────────────────────────────────────────
let _sparkId = 0
function Spark({ data, stroke = '#94a3b8', height = 32 }) {
  const id = useRef(`sk${++_sparkId}`).current
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={stroke} stopOpacity={0.2} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0}   />
          </linearGradient>
        </defs>
        <YAxis domain={['dataMin', 'dataMax']} hide />
        <Area type="monotone" dataKey="v"
          stroke={stroke} strokeWidth={1.5}
          fill={`url(#${id})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── LOG TEMPLATES ────────────────────────────────────────────────────────────
const LOG_TEMPLATES = [
  d => `[NFT] pH стабільний: ${d.nftPh}`,
  d => `[DWC] EC в нормі: ${d.dwcEc} mS/cm`,
  d => `[ROOM] Температура: ${d.roomTemp}°C`,
  () => `[NFT] Насос P1 — цикл завершено`,
  d => `[DWC] Рівень розчину: ${d.dwcLv}%`,
  () => `[ZIGBEE] Датчик HTU21D — оновлення`,
  d => `[NFT] NO₃ в нормі: ${d.nftNo3} mg/L`,
  d => `[ROOM] CO₂: ${d.co2} ppm`,
  d => `[DWC] DO: ${d.dwcDo} mg/L`,
  () => `[ZIGBEE] Усі вузли в мережі`,
]

// ─── CARD SHELL ───────────────────────────────────────────────────────────────
function Card({ children, className = '' }) {
  return (
    <div className={`bg-white dark:bg-[#1e1d1b] rounded-3xl shadow-[0_2px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_20px_rgba(0,0,0,0.35)] ${className}`}>
      {children}
    </div>
  )
}

// ─── KPI BAR ─────────────────────────────────────────────────────────────────
function KpiBar({ data, alerts }) {
  const overallS = alerts === 0 ? 'ok' : alerts > 2 ? 'crit' : 'warn'
  const co2S = data.room.co2 > 1200 ? 'crit' : data.room.co2 > 900 ? 'warn' : 'ok'

  return (
    <div className="flex flex-wrap items-center gap-8 py-2">

      {/* Status */}
      <div className="flex items-center gap-2.5">
        <div className={`w-2.5 h-2.5 rounded-full ${dotCls(overallS)}`} />
        <span className={`text-lg font-semibold ${overallS === 'ok' ? 'text-emerald-700' : overallS === 'warn' ? 'text-amber-600' : 'text-red-600'}`}>
          {overallS === 'ok' ? 'Підключення активне' : overallS === 'warn' ? 'Увага' : 'Критично'}
        </span>
        {alerts > 0 && (
          <span className="text-sm text-stone-400 flex items-center gap-1">
            <AlertTriangle size={12} className="text-amber-400" />{alerts} сигнал{alerts === 1 ? '' : 'и'}
          </span>
        )}
      </div>

      <div className="h-6 w-px bg-stone-200 dark:bg-stone-700" />

      <KpiCell label="Розчин 1"    value={data.nft.lv}    unit="%" status={lvStatus(data.nft.lv)} Icon={Beaker} />
      <KpiCell label="Розчин 2"    value={data.dwc.lv}    unit="%" status={lvStatus(data.dwc.lv)} Icon={Beaker} />

      <div className="h-6 w-px bg-stone-200 dark:bg-stone-700" />

      <KpiCell label="Температура" value={data.room.temp}  unit="°C"  Icon={Thermometer} />
      <KpiCell label="Вологість"   value={data.room.hum}   unit="%"   Icon={Droplets} />
      <KpiCell label="CO₂"         value={data.room.co2}   unit="ppm" Icon={Wind} status={co2S} />
      <KpiCell label="Освітлення"  value={data.room.lux}   unit="лк"  Icon={SunIcon} />
    </div>
  )
}

function KpiCell({ label, value, unit, status = 'ok', Icon }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-stone-400 dark:text-stone-500 flex items-center gap-1">
        {Icon && <Icon size={11} className="opacity-60" />}{label}
      </span>
      <div className="flex items-baseline gap-1">
        <span className={`mono text-2xl font-semibold leading-none ${valCls(status)}`}>{value}</span>
        <span className="text-sm text-stone-400">{unit}</span>
      </div>
    </div>
  )
}

// ─── TANK LEVEL ───────────────────────────────────────────────────────────────
function TankLevel({ value, status }) {
  const fillColor = status === 'crit' ? '#ef4444' : status === 'warn' ? '#f59e0b' : '#00D5BE'
  const textCls = status === 'crit' ? 'text-red-500' : status === 'warn' ? 'text-amber-500' : 'text-stone-500 dark:text-stone-400'

  return (
    <div className="flex items-center gap-2.5">
      {/* Vertical tank */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-[9px] uppercase tracking-widest text-stone-400 dark:text-stone-600">Рівень</span>
        <div className="relative w-7 h-10 rounded-md border-2 border-stone-200 dark:border-stone-700 overflow-hidden bg-stone-50 dark:bg-stone-800">
          {/* Tick marks */}
          {[25, 50, 75].map(t => (
            <div key={t} className="absolute w-full border-t border-stone-200/70 dark:border-stone-700/50"
              style={{ bottom: `${t}%` }} />
          ))}
          {/* Fill */}
          <div
            className="absolute bottom-0 left-0 right-0 transition-all duration-1000 rounded-sm"
            style={{ height: `${value}%`, backgroundColor: fillColor, opacity: 0.85 }}
          />
        </div>
        <span className={`mono text-[11px] font-semibold leading-none ${textCls}`}>{value}%</span>
      </div>
    </div>
  )
}

// ─── HYDRO CARD ───────────────────────────────────────────────────────────────
function HydroCard({ name, abbr, sys, cropNames }) {
  const { ph, no3, do_, ec, wt, lv, phHist } = sys
  const phS  = phStatus(ph)
  const no3S = no3Status(no3)
  const doS  = doStatus(do_)
  const lvS  = lvStatus(lv)
  const overallS = [phS, no3S, doS, lvS].some(s => s === 'crit') ? 'crit'
    : [phS, no3S, doS, lvS].some(s => s === 'warn') ? 'warn' : 'ok'

  const sparkStroke = phS === 'crit' ? '#ef4444' : phS === 'warn' ? '#f59e0b' : '#6ee7b7'

  return (
    <Card className="p-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`w-2 h-2 rounded-full ${dotCls(overallS)}`} />
          <span className="font-semibold text-stone-800 dark:text-stone-100 text-base">{name}</span>
          <span className="text-sm text-stone-400 dark:text-stone-600">{abbr}</span>
        </div>
        <TankLevel value={lv} status={lvS} />
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'pH',       v: ph,  s: phS  },
          { label: 'NO₃ mg/L', v: no3, s: no3S },
          { label: 'DO mg/L',  v: do_, s: doS  },
          { label: 'EC mS/cm', v: ec,  s: 'ok' },
          { label: 'Вода °C',  v: wt,  s: 'ok' },
        ].map(({ label, v, s }) => (
          <div key={label} className="flex flex-col gap-1.5 min-w-0">
            <span className="text-[10px] text-stone-400 dark:text-stone-600 uppercase tracking-widest leading-none">{label}</span>
            <span className={`mono text-2xl font-semibold leading-none ${valCls(s)}`}>{v}</span>
          </div>
        ))}
      </div>

      {/* pH trend */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-stone-400 dark:text-stone-600">pH тренд</span>
          <span className="text-xs text-stone-300 dark:text-stone-700">40 відліків</span>
        </div>
        <Spark data={phHist} stroke={sparkStroke} height={36} />
      </div>

      {/* Crops */}
      {cropNames.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-1">
          {cropNames.map(n => (
            <span key={n} className="text-sm text-stone-400 dark:text-stone-600">{n}</span>
          ))}
        </div>
      )}
    </Card>
  )
}

// ─── CROP TABLE ───────────────────────────────────────────────────────────────
const COL = '1fr 1.4fr 80px 72px 72px'

const HYDRO_CROPS = CROPS.filter(c => c.medium === 'hydro')
const SOIL_CROPS  = CROPS.filter(c => c.medium === 'soil')

function CropTable({ cropData }) {
  return (
    <Card className="overflow-hidden px-2 py-4">
      <div className="px-4 pb-4">
        <span className="text-xs text-stone-400 dark:text-stone-600 uppercase tracking-widest">Монітор культур</span>
      </div>

      <GroupHeader label="Гідропоніка" cols={['Культура', 'Зволоженість', 'Темп.', 'Люкс', 'EC']} />
      {HYDRO_CROPS.map(crop => (
        <CropRow key={crop.id} crop={crop} s={cropData.find(c => c.id === crop.id)} />
      ))}

      <div className="my-2" />

      <GroupHeader label="Ґрунт" cols={['Культура', 'Вологість ґрунту', 'Темп.', 'Люкс', 'Родючість']} />
      {SOIL_CROPS.map(crop => (
        <CropRow key={crop.id} crop={crop} s={cropData.find(c => c.id === crop.id)} />
      ))}
    </Card>
  )
}

function GroupHeader({ label, cols }) {
  return (
    <div className="grid items-center px-4 py-2 gap-4 bg-stone-50 dark:bg-stone-800/60 rounded-xl mx-2 mb-1"
      style={{ gridTemplateColumns: COL }}>
      <span className="text-[10px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-widest">{label}</span>
      {cols.slice(1).map((h, i) => (
        <span key={h} className={`text-[10px] text-stone-400 dark:text-stone-600 uppercase tracking-wide ${i > 0 ? 'text-right' : ''}`}>{h}</span>
      ))}
    </div>
  )
}

function CropRow({ crop, s }) {
  if (!s) return null
  const mS = moistStatus(s.moist)
  const tempOk = s.temp >= crop.optimalTemp[0] && s.temp <= crop.optimalTemp[1]

  return (
    <div
      className="grid items-center px-4 py-3.5 gap-4 mx-2 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors"
      style={{ gridTemplateColumns: COL }}>

      <div className="flex items-center gap-3 min-w-0">
        <div className="w-1 h-7 rounded-full shrink-0" style={{ backgroundColor: crop.color }} />
        <div className="min-w-0">
          <div className="text-base font-medium text-stone-700 dark:text-stone-200 truncate">{crop.name}</div>
        </div>
      </div>

      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex-1 h-1 bg-stone-100 dark:bg-stone-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${mS === 'warn' ? 'bg-amber-400' : 'bg-[#00D5BE]'}`}
            style={{ width: `${Math.min(s.moist, 100)}%` }}
          />
        </div>
        <span className={`mono text-sm shrink-0 w-10 text-right font-medium ${mS === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-stone-500 dark:text-stone-400'}`}>
          {s.moist}%
        </span>
      </div>

      <span className={`mono text-sm text-right ${tempOk ? 'text-stone-500' : 'text-amber-600'}`}>{s.temp}°C</span>
      <span className="mono text-sm text-right text-stone-400 dark:text-stone-500">{s.lum}</span>
      <span className="mono text-sm text-right text-stone-400 dark:text-stone-500">{s.fert}</span>
    </div>
  )
}

// ─── ROOM PANEL ───────────────────────────────────────────────────────────────
function RoomPanel({ room }) {
  const co2S = room.co2 > 1200 ? 'crit' : room.co2 > 900 ? 'warn' : 'ok'
  const co2Stroke = co2S === 'crit' ? '#ef4444' : co2S === 'warn' ? '#f59e0b' : '#94a3b8'

  return (
    <Card className="p-6 flex flex-col gap-6 h-full">
      <span className="text-xs font-semibold text-stone-400 dark:text-stone-600 uppercase tracking-widest">Середовище</span>

      <div className="grid grid-cols-2 gap-x-4 gap-y-5 flex-1">
        <EnvStat label="Температура" value={room.temp} unit="°C" />
        <EnvStat label="Вологість"   value={room.hum}  unit="%" />
        <div>
          <EnvStat label="CO₂" value={room.co2} unit="ppm" status={co2S} />
          <div className="mt-2">
            <Spark data={room.co2Hist} stroke={co2Stroke} height={24} />
          </div>
        </div>
        <EnvStat label="Освітлення" value={room.lux} unit="лк" />
      </div>
    </Card>
  )
}

function EnvStat({ label, value, unit, status = 'ok' }) {
  return (
    <div>
      <div className="text-xs text-stone-400 dark:text-stone-600 uppercase tracking-wide mb-1.5">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className={`mono text-3xl font-semibold leading-none ${valCls(status)}`}>{value}</span>
        <span className="text-sm text-stone-400 dark:text-stone-600">{unit}</span>
      </div>
    </div>
  )
}

// ─── CAMERA ───────────────────────────────────────────────────────────────────
function CameraCard() {
  return (
    <Card className="flex-1 min-h-52 overflow-hidden relative bg-white dark:bg-[#1e1d1b]">
      <iframe
        src="https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&mute=1&controls=1&rel=0"
        title="Камера лабораторії"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full border-0"
      />
    </Card>
  )
}

// ─── JOURNAL ─────────────────────────────────────────────────────────────────
function Journal({ entries, open, onToggle }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [entries])

  return (
    <div className="border-t border-stone-200 dark:border-stone-800 pt-3">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-stone-400 dark:text-stone-600 hover:text-stone-600 dark:hover:text-stone-400 transition-colors mb-2"
      >
        <Terminal size={12} />
        <span className="text-xs">Системний журнал ({entries.length})</span>
        {open ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      </button>
      {open && (
        <div ref={ref} className="h-28 overflow-y-auto bg-stone-50 dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-xl p-3 space-y-0.5">
          {entries.map((e, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="mono text-[10px] text-stone-400 dark:text-stone-600 shrink-0 tabular-nums">{e.time}</span>
              <span className={`mono text-[11px] ${e.level === 'warn' ? 'text-amber-600 dark:text-amber-500' : e.level === 'err' ? 'text-red-600 dark:text-red-500' : 'text-stone-500 dark:text-stone-500'}`}>
                {e.msg}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── APP ─────────────────────────────────────────────────────────────────────
const NFT_CROPS = ['lettuce']   // Живильний шар — ідеально для листових
const DWC_CROPS = ['spinach']   // Глибоководна культура

export default function App() {
  const sensorsRef = useRef(null)
  const [data, setData]       = useState(null)
  const [tick, setTick]       = useState(0)
  const [time, setTime]       = useState('')
  const [journal, setJournal] = useState([])
  const [logOpen, setLogOpen] = useState(false)
  const [isDark, setIsDark]   = useState(false)

  const snapshot = useCallback(() => {
    const s = sensorsRef.current
    if (!s) return
    setData({
      room: {
        temp: s.room.temp.get(), hum:  s.room.hum.get(),
        co2:  s.room.co2.get(),  lux:  s.room.lux.get(),
        co2Hist: s.room.co2.histData(),
      },
      nft: {
        wt: s.nft.wt.get(), ph:  s.nft.ph.get(),  do_: s.nft.do_.get(),
        ec: s.nft.ec.get(), lv:  s.nft.lv.get(),  no3: s.nft.no3.get(),
        phHist: s.nft.ph.histData(),
      },
      dwc: {
        wt: s.dwc.wt.get(), ph:  s.dwc.ph.get(),  do_: s.dwc.do_.get(),
        ec: s.dwc.ec.get(), lv:  s.dwc.lv.get(),  no3: s.dwc.no3.get(),
        phHist: s.dwc.ph.histData(),
      },
      crops: s.crops.map(c => ({
        id:    c.id,
        moist: c.moist.get(), temp: c.temp.get(),
        lum:   c.lum.get(),   fert: c.fert.get(),
      })),
    })
  }, [])

  useEffect(() => {
    sensorsRef.current = buildSensors()
    const s = sensorsRef.current
    for (let i = 0; i < 80; i++) {
      Object.values(s.room).forEach(n => n.tick())
      Object.values(s.nft).forEach(n  => { if (n instanceof SensorNode) n.tick() })
      Object.values(s.dwc).forEach(n  => { if (n instanceof SensorNode) n.tick() })
      s.crops.forEach(c => Object.values(c).forEach(n => { if (n instanceof SensorNode) n.tick() }))
    }
    snapshot()
    setJournal([
      { time: '—', msg: '[SYS] Ініціалізація завершена', level: 'ok' },
      { time: '—', msg: '[ZIGBEE] 14 вузлів знайдено, 14 онлайн', level: 'ok' },
      { time: '—', msg: '[NFT] Система підключена', level: 'ok' },
      { time: '—', msg: '[DWC] Система підключена', level: 'ok' },
    ])
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      const s = sensorsRef.current
      if (!s) return
      Object.values(s.room).forEach(n => n.tick())
      Object.values(s.nft).forEach(n  => { if (n instanceof SensorNode) n.tick() })
      Object.values(s.dwc).forEach(n  => { if (n instanceof SensorNode) n.tick() })
      s.crops.forEach(c => Object.values(c).forEach(n => { if (n instanceof SensorNode) n.tick() }))
      snapshot()
      setTime(new Date().toLocaleTimeString('uk-UA'))
      setTick(t => {
        const next = t + 1
        if (next % 5 === 0) {
          const tmpl = LOG_TEMPLATES[Math.floor(Math.random() * LOG_TEMPLATES.length)]
          const msg = tmpl({
            nftPh: s.nft.ph.get(), dwcEc: s.dwc.ec.get(),
            roomTemp: s.room.temp.get(), dwcLv: s.dwc.lv.get(),
            nftNo3: s.nft.no3.get(), co2: s.room.co2.get(),
            dwcDo: s.dwc.do_.get(),
          })
          const level = no3Status(s.nft.no3.get()) !== 'ok' || s.room.co2.get() > 1200 ? 'warn' : 'ok'
          const ts = new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          setJournal(j => [...j.slice(-80), { time: ts, msg, level }])
        }
        return next
      })
    }, 4000)
    setTime(new Date().toLocaleTimeString('uk-UA'))
    return () => clearInterval(id)
  }, [snapshot])

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="flex items-center gap-2 text-stone-400">
          <RefreshCw size={16} className="animate-spin" />
          <span>Ініціалізація…</span>
        </div>
      </div>
    )
  }

  const alertCount = [
    phStatus(data.nft.ph),  phStatus(data.dwc.ph),
    no3Status(data.nft.no3), no3Status(data.dwc.no3),
    doStatus(data.nft.do_),  doStatus(data.dwc.do_),
    lvStatus(data.nft.lv),   lvStatus(data.dwc.lv),
    data.room.co2 > 900 ? 'warn' : 'ok',
  ].filter(s => s !== 'ok').length

  const nftCropNames = NFT_CROPS.map(id => CROPS.find(c => c.id === id)?.name).filter(Boolean)
  const dwcCropNames = DWC_CROPS.map(id => CROPS.find(c => c.id === id)?.name).filter(Boolean)

  return (
    <div className={`${isDark ? 'dark' : ''} min-h-screen bg-[#f5f4f0] dark:bg-[#141412] py-7 px-8 md:px-12`}>

      {/* ── HEADER ── */}
      <header className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Leaf size={18} className="text-stone-400 shrink-0" />
          <span className="text-lg font-semibold text-stone-800 dark:text-stone-100">Моніторинг лабораторії</span>
          <span className="text-stone-300 dark:text-stone-700 mx-1">·</span>
          <span className="text-stone-400 dark:text-stone-500">Кафедра екології та охорони здоров'я ЗУНУ</span>
        </div>
        <div className="flex items-center gap-5 text-stone-400 dark:text-stone-600">
          <div className="flex items-center gap-1.5">
            <RefreshCw size={11} />
            <span className="mono text-xs">#{tick}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={12} />
            <span className="mono text-sm font-medium text-stone-600 dark:text-stone-400">{time}</span>
          </div>
          <button
            onClick={() => setIsDark(d => !d)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-stone-400 dark:text-stone-500"
            title={isDark ? 'Світла тема' : 'Темна тема'}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </header>

      {/* ── KPI BAR ── */}
      <div className="mb-8">
        <KpiBar data={data} alerts={alertCount} />
      </div>

      {/* ── ROW 1: Camera left · Crop Monitor right ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-5">
        <div className="lg:col-span-2 flex flex-col">
          <CameraCard />
        </div>
        <div className="lg:col-span-3">
          <CropTable cropData={data.crops} />
        </div>
      </div>

      {/* ── ROW 2: NFT · DWC · Environment ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-5">
        <HydroCard name="Поживний розчин 1" abbr="Живильний шар"      sys={data.nft} cropNames={nftCropNames} />
        <HydroCard name="Поживний розчин 2" abbr="Глибоководна культура" sys={data.dwc} cropNames={dwcCropNames} />
        <RoomPanel room={data.room} />
      </div>

      {/* ── JOURNAL ── */}
      <Journal entries={journal} open={logOpen} onToggle={() => setLogOpen(o => !o)} />

    </div>
  )
}
