## O que muda

<!-- Uma ou duas frases. -->

## Checklist de mudança segura

- [ ] Nenhum campo foi removido/renomeado nos contratos `v1` (só adições opcionais)
- [ ] Migração nova é só aditiva (sem DROP/RENAME), com RLS nas tabelas novas
- [ ] Função nova está atrás de feature flag (desligada por padrão)
- [ ] Testes novos cobrem a mudança
- [ ] Testado no staging
- [ ] Sei como desfazer (rollback no Render / desligar a flag)
