import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Ban,
  BadgeCheck,
  ChartLine,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Download,
  Eye,
  EyeOff,
  Flag,
  Gauge,
  HeartPulse,
  Info,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Minus,
  Radio,
  RefreshCw,
  RotateCcw,
  Rocket,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  TrendingUp,
  TriangleAlert,
  Users,
  Video,
  X,
} from 'lucide-react'

// Registro único de iconos del panel: las secciones y las acciones
// comparten nombres semánticos para que el lenguaje visual no se disperse.
const ICONS = {
  overview: Gauge,
  live: Radio,
  users: Users,
  creators: Video,
  analytics: ChartLine,
  feedback: Star,
  partners: Rocket,
  businessVerification: BadgeCheck,
  content: ClipboardList,
  reports: Flag,
  moderation: Clock,

  brand: HeartPulse,
  dashboard: LayoutDashboard,
  activity: Activity,
  trend: TrendingUp,
  messages: MessageSquare,
  insight: Sparkles,
  info: Info,
  alert: TriangleAlert,

  search: Search,
  filters: SlidersHorizontal,
  refresh: RefreshCw,
  reset: RotateCcw,
  download: Download,
  close: X,
  menu: Menu,
  check: Check,
  ban: Ban,
  show: Eye,
  hide: EyeOff,
  arrowUp: ArrowUp,
  arrowDown: ArrowDown,
  arrowRight: ArrowRight,
  sort: ArrowUpDown,
  prev: ChevronLeft,
  next: ChevronRight,
  flat: Minus,
}

export function AdminIcon({ name, size = 16, strokeWidth = 2, style = {}, className = '', ...props }) {
  const Component = ICONS[name]
  if (!Component) return null
  return (
    <Component
      aria-hidden="true"
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      style={{ flexShrink: 0, display: 'block', ...style }}
      {...props}
    />
  )
}

export default AdminIcon
