# Bloody War Auto — v0.1 (Firefox)

Extensão para Firefox que automatiza o jogo [The Bloody War](https://www.thebloodywar.com/).

## Como instalar

1. Abra `about:debugging#/runtime/this-firefox`
2. Clique em **"Carregar extensão temporária…"**
3. Selecione o arquivo `manifest.json` desta pasta
4. Abra `https://www.thebloodywar.com/` em uma aba e faça login
5. Clique no ícone da extensão, ligue o toggle mestre e configure alvos/filtros

> **Para instalação permanente** (sem recarregar a cada reinício), a extensão
> precisa ser assinada pela Mozilla ou instalada via política de grupo.
> Em desenvolvimento, use a instalação temporária acima.

## O que automatiza

- **Batalhas (PDL)** — ataca Bots ou Jogadores com filtros configuráveis
- **Criaturas (PDB)** — navega no Mapa Mundo e ataca a criatura configurada
- **Trabalho** — inicia turnos de trabalho com agendamento diário/semanal
- **Treinamento** — compra upgrades de atributos respeitando reserva de gold
- **Saúde** — usa ou compra poções quando o HP cai abaixo do limite
- **Relatórios** — painel de análise com gráficos e histórico de sessões

## Estrutura dos arquivos

| Arquivo | Função |
|---|---|
| `manifest.json` | Configuração da extensão (Manifest V3, Firefox) |
| `shared.js` | Config padrão + helpers de storage |
| `content.js` | Roda no jogo: lê slots, executa ataques |
| `background.js` | Gerencia alarmes (auto-disable) |
| `popup.html/js/css` | Painel rápido (liga/desliga, status, log) |
| `options.html/js/css` | Configurações completas + relatórios |
| `reports.js` | Motor de gráficos e análise de dados |
