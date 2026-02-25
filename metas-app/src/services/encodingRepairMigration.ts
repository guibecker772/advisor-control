import {
  calendarAccountRepository,
  calendarEventRepository,
  captacaoLancamentoRepository,
  clienteRepository,
  clienteReuniaoRepository,
  crossRepository,
  custodiaReceitaRepository,
  eventReminderRepository,
  monthlyGoalsRepository,
  notificationRepository,
  offerReservationRepository,
  planoReceitasRepository,
  prospectInteracaoRepository,
  prospectRepository,
  reservaRepository,
  salarioRepository,
  isLocalDataDriver,
} from './repositories';

const MIGRATION_KEY = 'ac_mojibake_repair_v1';

const repositories = [
  clienteRepository,
  clienteReuniaoRepository,
  prospectRepository,
  prospectInteracaoRepository,
  crossRepository,
  reservaRepository,
  offerReservationRepository,
  custodiaReceitaRepository,
  planoReceitasRepository,
  salarioRepository,
  captacaoLancamentoRepository,
  monthlyGoalsRepository,
  calendarEventRepository,
  calendarAccountRepository,
  notificationRepository,
  eventReminderRepository,
];

export async function runEncodingRepairMigration(ownerUid: string): Promise<void> {
  if (!isLocalDataDriver) return;
  if (!ownerUid) return;

  const migrationToken = `${MIGRATION_KEY}__${ownerUid}`;
  const alreadyApplied = localStorage.getItem(migrationToken);
  if (alreadyApplied === '1') return;

  for (const repository of repositories) {
    await repository.getAll(ownerUid);
  }

  localStorage.setItem(migrationToken, '1');
}
