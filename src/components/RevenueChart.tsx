import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useSettings } from '@/state/SettingsContext'
import { formatMoney } from '@/lib/utils'

export interface RevenuePoint {
  day: string
  total: number
}

/** Split out of the dashboard so recharts (~430 kB) loads after the stats render. */
export default function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const { t, lang, dark } = useSettings()
  const axisColor = dark ? '#9FB3CE' : '#6B7C93'

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
      <AreaChart data={data} margin={{ top: 8, right: 6, left: -22, bottom: 0 }}>
        <defs>
          <linearGradient id="adminRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1868FE" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#1868FE" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={dark ? 'rgba(255,255,255,0.08)' : 'rgba(11,31,58,0.08)'} />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10, fill: axisColor }}
          dy={4}
          interval="preserveStartEnd"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10, fill: axisColor }}
          width={52}
          tickFormatter={(value) => {
            const n = Number(value)
            return n >= 1000 ? `₹${Math.round(n / 1000)}k` : `₹${n}`
          }}
        />
        <Tooltip
          cursor={{ stroke: '#1868FE', strokeDasharray: '3 3' }}
          contentStyle={{
            borderRadius: 12,
            border: 'none',
            background: dark ? '#122A4A' : '#0B1F3A',
            color: '#fff',
            fontSize: 12,
            padding: '6px 10px',
          }}
          labelStyle={{ color: '#CBD5E1', fontSize: 11, marginBottom: 2 }}
          formatter={(value) => [formatMoney(Number(value), lang), t('admin.todayRevenue')]}
        />
        <Area
          type="monotone"
          dataKey="total"
          stroke="#1868FE"
          strokeWidth={2.5}
          fill="url(#adminRevenue)"
          activeDot={{ r: 4, strokeWidth: 2, stroke: '#0B1F3A' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
