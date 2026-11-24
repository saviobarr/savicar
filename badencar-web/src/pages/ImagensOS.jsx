import { useState } from 'react'
import { fetchImagesByOrder, imageFileUrl } from '../api'

export default function ImagensOS() {
  const [idOrder, setIdOrder] = useState('')
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searched, setSearched] = useState(false)
  const [modalUrl, setModalUrl] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSearched(false)
    try {
      const data = await fetchImagesByOrder(idOrder)
      setImages(data)
      setSearched(true)
    } catch (err) {
      setError(err.message)
      setImages([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <h2>Imagens da Ordem de Serviço</h2>
      <form onSubmit={handleSubmit} className="search-form">
        <label htmlFor="idOrder">Ordem de Serviço</label>
        <input
          id="idOrder"
          name="idOrder"
          type="text"
          value={idOrder}
          onChange={(e) => setIdOrder(e.target.value)}
          placeholder="Digite o ID da OS"
        />
        <button type="submit">BUSCAR</button>
      </form>

      {loading && <p className="loading">Carregando...</p>}
      {error && <p className="error">{error}</p>}

      {searched && !loading && !error && (
        images.length === 0 ? (
          <p>Nenhuma imagem encontrada.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID Imagem</th>
                <th>ID Ordem</th>
                <th>Caminho da Imagem</th>
              </tr>
            </thead>
            <tbody>
              {images.map((img) => (
                <tr key={img.id_image}>
                  <td>{img.id_image}</td>
                  <td>{img.id_order}</td>
                  <td>
                    <a
                      href="#"
                      onClick={(e) => { e.preventDefault(); setModalUrl(imageFileUrl(img.id_image)) }}
                    >
                      {img.image_path}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {modalUrl && (
        <div className="modal-overlay" onClick={() => setModalUrl(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setModalUrl(null)}>✕</button>
            <img src={modalUrl} alt="Imagem OS" />
          </div>
        </div>
      )}
    </div>
  )
}
