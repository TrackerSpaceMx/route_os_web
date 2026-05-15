import LeftPanel from '../components/LeftPanel'
import RightPanel from '../components/RightPanel'

export default function LoginPage() {
  return (
    <div style={{ display: 'flex', width: '100%', minHeight: '100vh', flexWrap: 'wrap' }}>
      <LeftPanel />
      <RightPanel />
    </div>
  )
}
