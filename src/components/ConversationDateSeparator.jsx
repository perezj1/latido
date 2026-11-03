import { messageDay, messageDayLabel } from '../lib/conversationPresentation'
import './ConversationDateSeparator.css'

export default function ConversationDateSeparator({ date }) {
  const label = messageDayLabel(date)
  if (!label) return null
  return <div className="conversation-date-separator"><time dateTime={messageDay(date)}>{label}</time></div>
}
