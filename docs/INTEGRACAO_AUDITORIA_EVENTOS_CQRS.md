# Integração: Sistema de Auditoria com Eventos CQRS

## Visão Geral

O sistema possui dois mecanismos complementares de registro:

1. **Sistema de Eventos CQRS** (`esv-event-store`): Registra eventos de domínio (CREATE, UPDATE, DELETE)
2. **Sistema de Auditoria** (`AuditLog`): Registra ações específicas de conformidade legal (CFM, LGPD)

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    Sistema de Auditoria                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Eventos CQRS (esv-event-store)                      │   │
│  │  - CREATE, UPDATE, DELETE                            │   │
│  │  - Eventos de domínio imutáveis                      │   │
│  │  - Event sourcing                                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                          +                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  AuditLog (Conformidade Legal)                        │   │
│  │  - ACCESS, PRINT, EXPORT, SIGN                       │   │
│  │  - Metadados de conformidade (IP, user agent)        │   │
│  │  - Compliance flags (LGPD, assinatura)               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Quando Usar Cada Sistema

### Sistema de Eventos CQRS
- **Quando**: Eventos de domínio (CREATE, UPDATE, DELETE)
- **Onde**: `esv-event-store` (PostgreSQL)
- **Propósito**: Event sourcing, reconstrução de estado, sincronização entre serviços
- **Exemplo**: `PrescriptionCreated`, `MedicalExamOrderUpdated`

### Sistema de Auditoria (AuditLog)
- **Quando**: Ações de conformidade legal
- **Onde**: Firestore (`audit-log` collection)
- **Propósito**: Conformidade CFM Resolução 1.821/2007, LGPD
- **Exemplos**:
  - `ACCESS`: Acesso a dados sensíveis (LGPD)
  - `PRINT`: Impressão de documentos médicos
  - `EXPORT`: Exportação de dados do paciente
  - `SIGN`: Assinatura digital de documentos
  - `LOGIN`/`LOGOUT`: Autenticação

## Integração

### AuditInterceptor

O `AuditInterceptor` complementa o sistema de eventos:

```typescript
// Eventos CQRS são registrados automaticamente via publish()
publish(new PrescriptionCreated(...));

// AuditLog registra ações de conformidade
await auditLogService.logAction(userId, 'SIGN', 'prescription', id, {
  complianceFlags: { signedDocument: true },
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
});
```

### Exemplo: Assinatura de Prescrição

1. **Evento CQRS**: `PrescriptionSigned` (se necessário para sincronização)
2. **AuditLog**: Registra ação `SIGN` com metadados de conformidade

```typescript
// 1. Assinar documento
const signature = await digitalSignatureService.signDocument(...);

// 2. Atualizar entidade
prescription.isSigned = true;
prescription.digitalSignature = signature.signature;
await prescriptionRepository.update(prescription);

// 3. Registrar no AuditLog (conformidade legal)
await auditLogService.logAction(userId, 'SIGN', 'prescription', id, {
  complianceFlags: { signedDocument: true },
  metadata: { certificateIssuer: signature.certificateInfo.issuer },
});
```

## Validação de Bloqueio Após Assinatura

Documentos assinados não podem ser alterados:

```typescript
// Em PrescriptionService, MedicalExamOrderService, etc.
async updatePrescription(id: string, updateDto: any, user: string) {
  const prescription = await this.getPrescriptionById(id);

  // Bloqueio após assinatura
  if (prescription.isSigned) {
    throw new HttpException(
      'Prescrição assinada não pode ser alterada',
      HttpStatus.BAD_REQUEST
    );
  }

  // ... resto da lógica
}
```

## Consultas

### Eventos CQRS
```typescript
// Buscar eventos por aggregateId
const events = await eventsService.getEventsByAggregateId(prescriptionId);
```

### AuditLog
```typescript
// Buscar logs de auditoria
const logs = await auditLogService.getLogsByEntity('prescription', prescriptionId);
const userLogs = await auditLogService.getLogsByUser(userId);
const report = await auditLogService.generateAuditReport({ ... });
```

## Conformidade Legal

### CFM Resolução 1.821/2007
- ✅ Registro de todas as ações (AuditLog)
- ✅ Assinatura digital ICP-Brasil
- ✅ Bloqueio após assinatura
- ✅ Retenção de 20 anos

### LGPD (Lei 13.709/2018)
- ✅ Registro de acessos (AuditLog.ACCESS)
- ✅ Registro de exportações (AuditLog.EXPORT)
- ✅ Consentimento (complianceFlags.lgpdConsent)
- ✅ Portabilidade de dados

## Próximos Passos

1. ✅ Integração com sistema de eventos CQRS
2. ✅ Validação de bloqueio após assinatura
3. ⏳ Dashboard de auditoria no frontend
4. ⏳ Relatórios de conformidade automáticos
5. ⏳ Alertas de ações suspeitas





