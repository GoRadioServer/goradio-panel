import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ListenerStatPoint } from '../api/types'

export function ListenerChart({ points }: { points: ListenerStatPoint[] }) {
  if (points.length === 0) {
    return <div className="empty">No listener data captured yet.</div>
  }

  const data = points.map((p) => ({
    time: new Date(p.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    listeners: p.listener_count,
  }))

  const axis = { stroke: '#62666f', fontSize: 11, tickLine: false }

  return (
    <div style={{ width: '100%', height: 190 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="listenerFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f97316" stopOpacity={0.42} />
              <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#23252d" vertical={false} />
          <XAxis dataKey="time" {...axis} axisLine={{ stroke: '#23252d' }} minTickGap={34} />
          <YAxis {...axis} axisLine={false} allowDecimals={false} width={38} />
          <Tooltip
            cursor={{ stroke: '#2f323c' }}
            contentStyle={{
              background: '#181a21',
              border: '1px solid #2f323c',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: '#8d919e' }}
            itemStyle={{ color: '#fb923c' }}
          />
          <Area
            type="monotone"
            dataKey="listeners"
            stroke="#f97316"
            strokeWidth={2}
            fill="url(#listenerFill)"
            dot={false}
            activeDot={{ r: 3.5, fill: '#f97316', stroke: '#0a0b0f', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
