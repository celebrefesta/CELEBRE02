import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; // 🔥 Importação do Cadeado de Segurança
import './NovoFornecedor.css';

const NovoFornecedor = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  // 🔥 Autenticação
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;

  const [loading, setLoading] = useState(isEditing);
  const [salvando, setSalvando] = useState(false);

  // Estados do Formulário
  const [logoPreview, setLogoPreview] = useState(null);
  const [categoria, setCategoria] = useState('Estoque / Consumo');
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [prazo, setPrazo] = useState('');
  const [contato, setContato] = useState('');
  const [site, setSite] = useState('');
  const [pix, setPix] = useState('');
  const [endereco, setEndereco] = useState('');
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    if (!usuarioLogado) {
        navigate('/login');
        return;
    }

    if (isEditing) {
        const buscarFornecedor = async () => {
            try {
                const docRef = doc(db, 'fornecedores', id);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data();
                    
                    // 🔥 BLINDAGEM: Verifica se o fornecedor pertence à sua conta
                    if (data.userId && data.userId !== usuarioLogado.uid) {
                        alert("Acesso negado: Este fornecedor pertence a outra empresa.");
                        navigate('/fornecedores');
                        return;
                    }

                    setLogoPreview(data.logo || null);
                    setCategoria(data.categoria || 'Estoque / Consumo');
                    setNome(data.nome || '');
                    setCnpj(data.cnpj || '');
                    setPrazo(data.prazo || '');
                    setContato(data.contato || '');
                    setSite(data.link || '');
                    setPix(data.pix || '');
                    setEndereco(data.local || '');
                    setObservacoes(data.observacoes || '');
                } else {
                    alert("Fornecedor não encontrado.");
                    navigate('/fornecedores');
                }
            } catch(e) {
                console.error(e);
                alert("Erro ao buscar dados do fornecedor.");
            } finally {
                setLoading(false);
            }
        };
        buscarFornecedor();
    }
  }, [id, usuarioLogado, navigate, isEditing]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!nome.trim()) return alert("O nome do fornecedor é obrigatório.");

    setSalvando(true);
    try {
        const dadosParaSalvar = {
            nome,
            cnpj,
            prazo,
            contato,
            link: site,
            pix,
            local: endereco,
            observacoes,
            categoria,
            logo: logoPreview,
            atualizadoEm: serverTimestamp()
        };

        if (isEditing) {
            await updateDoc(doc(db, 'fornecedores', id), dadosParaSalvar);
            alert("Fornecedor atualizado com sucesso!");
        } else {
            // 🔥 BLINDAGEM MULTI-EMPRESA: Salva o fornecedor com o seu userId
            await addDoc(collection(db, 'fornecedores'), {
                ...dadosParaSalvar,
                userId: usuarioLogado.uid, // 🔥 CADEADO DE SEGURANÇA
                criadoEm: serverTimestamp()
            });
            alert("Fornecedor cadastrado com sucesso!");
        }
        navigate('/fornecedores');
    } catch (error) {
        console.error("Erro ao salvar:", error);
        alert("Erro ao salvar o cadastro.");
    } finally {
        setSalvando(false);
    }
  };

  if (loading) return <div style={{padding: '50px', textAlign: 'center'}}>Carregando dados...</div>;

  return (
    <div className="novo-fornecedor-page">
      
      {/* Cabeçalho Simples */}
      <header className="page-header-simple">
        <div className="brand"><i className="fas fa-crown"></i> CELEBRE</div>
        <button className="back-link" onClick={() => navigate('/fornecedores')}>
            <i className="fas fa-arrow-left"></i> Voltar
        </button>
      </header>

      <div className="main-container">
        <form className="form-card" onSubmit={handleSalvar}>
            
            {/* Banner e Logo */}
            <div className="card-header-visual">
                <div className="logo-wrapper">
                    <input type="file" id="logo-input" hidden accept="image/*" onChange={handleImageChange} />
                  
                    <div className="logo-circle" onClick={() => document.getElementById('logo-input').click()} title="Adicionar Logo">
                        {logoPreview ? (
                            <img src={logoPreview} className="logo-preview" alt="Preview" />
                        ) : (
                            <div className="upload-icon">
                                <i className="fas fa-store fa-2x"></i>
                            </div>
                        )}
                    </div>
                    
                    <div className="camera-badge" onClick={() => document.getElementById('logo-input').click()}>
                        <i className="fas fa-camera"></i>
                    </div>
                </div>
            </div>

            <div className="card-body">
                
                <div className="section-heading">
                    <h1>{isEditing ? 'Editar Fornecedor' : 'Cadastrar Fornecedor'}</h1>
                    <p>Preencha os dados do seu parceiro comercial</p>
                </div>

                {/* Categorias Visuais */}
                <div className="category-grid">
                    <label className={`cat-card ${categoria === 'Estoque / Consumo' ? 'active' : ''}`}>
                        <input type="radio" name="tipo" checked={categoria === 'Estoque / Consumo'} onChange={() => setCategoria('Estoque / Consumo')} />
                        <i className="fas fa-boxes"></i>
                        <h3>Estoque / Consumo</h3>
                    </label>
                    <label className={`cat-card ${categoria === 'Acervo / Peças' ? 'active' : ''}`}>
                        <input type="radio" name="tipo" checked={categoria === 'Acervo / Peças'} onChange={() => setCategoria('Acervo / Peças')} />
                        <i className="fas fa-couch"></i>
                        <h3>Acervo / Peças</h3>
                    </label>
                    <label className={`cat-card ${categoria === 'Serviço / Frete' ? 'active' : ''}`}>
                        <input type="radio" name="tipo" checked={categoria === 'Serviço / Frete'} onChange={() => setCategoria('Serviço / Frete')} />
                        <i className="fas fa-shipping-fast"></i>
                        <h3>Serviço / Frete</h3>
                    </label>
                </div>

                {/* Formulário */}
                <div className="form-grid">
                    <div className="floating-label full">
                        <input type="text" placeholder=" " required value={nome} onChange={e => setNome(e.target.value)} />
                        <label>Nome do Fornecedor *</label>
                    </div>
                    <div className="floating-label">
                        <input type="text" placeholder=" " value={cnpj} onChange={e => setCnpj(e.target.value)} />
                        <label>CNPJ / CPF</label>
                    </div>
                    <div className="floating-label">
                        <input type="text" placeholder=" " value={prazo} onChange={e => setPrazo(e.target.value)} />
                        <label>Prazo de Entrega</label>
                    </div>
                    <div className="floating-label">
                        <input type="tel" placeholder=" " value={contato} onChange={e => setContato(e.target.value)} />
                        <label>WhatsApp</label>
                    </div>
                    <div className="floating-label">
                        <input type="text" placeholder=" " value={site} onChange={e => setSite(e.target.value)} />
                        <label>Site / Instagram</label>
                    </div>
                    <div className="floating-label full">
                        <input type="text" placeholder=" " style={{borderColor: '#c5a059'}} value={pix} onChange={e => setPix(e.target.value)} />
                        <label style={{color: '#0f233a'}}>Chave PIX (Principal)</label>
                    </div>
                    <div className="floating-label full">
                        <input type="text" placeholder=" " value={endereco} onChange={e => setEndereco(e.target.value)} />
                        <label>Endereço Completo</label>
                    </div>
                    <div className="floating-label full">
                        <textarea rows="3" placeholder=" " value={observacoes} onChange={e => setObservacoes(e.target.value)}></textarea>
                        <label>Observações</label>
                    </div>
                </div>

                {/* Botões de Ação */}
                <div className="actions">
                    <button type="button" className="btn-outline" onClick={() => navigate('/fornecedores')}>Cancelar</button>
                    <button type="submit" className="btn-primary" disabled={salvando}>
                        <i className="fas fa-check"></i> {salvando ? 'Salvando...' : 'Salvar Cadastro'}
                    </button>
                </div>

            </div>
        </form>
      </div>
    </div>
  );
};

export default NovoFornecedor;