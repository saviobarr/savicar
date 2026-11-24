import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

export function makeFormPages(FormComponent, title, returnPath) {
  function NewPage() {
    const navigate = useNavigate()
    const { state } = useLocation()
    // Allow callers to pre-fill form fields by navigating with
    // { state: { initialData: { id_customer_model: X, ... } } }
    const initialData = state?.initialData ?? null
    return (
      <div className="crud-page">
        <div className="crud-toolbar">
          <h2>Novo — {title}</h2>
        </div>
        <FormComponent
          initialData={initialData}
          onSaved={() => navigate(returnPath)}
          onCancel={() => navigate(returnPath)}
        />
      </div>
    )
  }

  function EditPage() {
    const navigate = useNavigate()
    const { state } = useLocation()
    useEffect(() => {
      if (!state?.item) navigate(returnPath, { replace: true })
    }, [])
    if (!state?.item) return null
    return (
      <div className="crud-page">
        <div className="crud-toolbar">
          <h2>Editar — {title}</h2>
        </div>
        <FormComponent
          initialData={state.item}
          onSaved={() => navigate(returnPath)}
          onCancel={() => navigate(returnPath)}
        />
      </div>
    )
  }

  return { NewPage, EditPage }
}
