import { missingConfig } from './config.ts'

function App() {
  return (
    <main>
      <h1>Mail Merge</h1>
      {missingConfig.length > 0 && (
        <p className="warning">
          Faltan variables de entorno: {missingConfig.join(', ')}. Ver <code>.env.example</code>.
        </p>
      )}
    </main>
  )
}

export default App
