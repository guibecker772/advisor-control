import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  CirclePlus,
  Clock3,
  Command,
  Compass,
  LayoutDashboard,
  Package,
  Pin,
  PinOff,
  Search,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';

import { Button, Modal, Tabs } from '../ui';
import { toastError } from '../../lib/toast';
import { readStorageJSON, storageKeyForUser, writeStorageJSON } from '../../lib/userStorage';
import type { AccessCapabilities } from '../../lib/access';
import type { Cliente, OfferReservation, Prospect } from '../../domain/types';
import type { CalendarEvent } from '../../domain/types/calendar';
import {
  calendarEventRepository,
  clienteRepository,
  offerReservationRepository,
  prospectRepository,
} from '../../services/repositories';

type CommandScope = 'all' | 'clients' | 'prospects' | 'agendas' | 'offers';
type EntryScope = Exclude<CommandScope, 'all'> | 'all';
type CommandSection = 'pinned' | 'recent' | 'navigation' | 'actions' | 'results';
type StoredCommandKind = 'route' | 'action' | 'entity';
type StoredEntityType = 'client' | 'prospect' | 'agenda' | 'offer';
type ActionId = 'new-client' | 'new-prospect' | 'new-event' | 'go-agendas-today';

interface StoredCommandEntry {
  id: string;
  kind: StoredCommandKind;
  scope: EntryScope;
  title: string;
  subtitle?: string;
  searchText?: string;
  href?: string;
  actionId?: ActionId;
  entityType?: StoredEntityType;
  entityId?: string;
  ts: number;
}

interface PaletteCommand {
  id: string;
  listId: string;
  section: CommandSection;
  scope: EntryScope;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  disabled?: boolean;
  disabledReason?: string;
  keywords: string;
  execute: () => void;
  persisted: StoredCommandEntry;
}

interface ScopeResultGroup {
  title: string;
  scope: Exclude<CommandScope, 'all'>;
  items: PaletteCommand[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  uid?: string;
  access: AccessCapabilities;
}

const RECENT_LIMIT = 10;
const PIN_LIMIT = 5;
const RESULT_LIMIT = 8;

const SCOPE_ITEMS = [
  { value: 'all', label: 'Tudo' },
  { value: 'clients', label: 'Clientes' },
  { value: 'prospects', label: 'Prospects' },
  { value: 'agendas', label: 'Agendas' },
  { value: 'offers', label: 'Ofertas' },
] as const;

const NAVIGATION_CONFIG = [
  {
    id: 'route:/',
    title: 'Visao geral',
    subtitle: 'Dashboard principal',
    href: '/',
    icon: <LayoutDashboard className="w-4 h-4" />,
    scope: 'all' as const,
  },
  {
    id: 'route:/agendas',
    title: 'Agendas',
    subtitle: 'Calendario de compromissos',
    href: '/agendas',
    icon: <Calendar className="w-4 h-4" />,
    scope: 'agendas' as const,
  },
  {
    id: 'route:/clientes',
    title: 'Clientes',
    subtitle: 'Carteira de clientes',
    href: '/clientes',
    icon: <Users className="w-4 h-4" />,
    scope: 'clients' as const,
  },
  {
    id: 'route:/prospects',
    title: 'Prospects',
    subtitle: 'Pipeline comercial',
    href: '/prospects',
    icon: <UserPlus className="w-4 h-4" />,
    scope: 'prospects' as const,
  },
  {
    id: 'route:/captacao',
    title: 'Captacao',
    subtitle: 'Movimentacoes de entradas e saidas',
    href: '/captacao',
    icon: <TrendingUp className="w-4 h-4" />,
    scope: 'offers' as const,
  },
  {
    id: 'route:/cross',
    title: 'Cross selling',
    subtitle: 'Receitas de cross',
    href: '/cross',
    icon: <Compass className="w-4 h-4" />,
    scope: 'offers' as const,
  },
  {
    id: 'route:/ofertas',
    title: 'Ofertas',
    subtitle: 'Ativos e liquidacoes',
    href: '/ofertas',
    icon: <Package className="w-4 h-4" />,
    scope: 'offers' as const,
  },
  {
    id: 'route:/metas',
    title: 'Metas',
    subtitle: 'Planejamento mensal',
    href: '/metas',
    icon: <Target className="w-4 h-4" />,
    scope: 'offers' as const,
  },
  {
    id: 'route:/salario',
    title: 'Salario',
    subtitle: 'Projecao e acompanhamento',
    href: '/salario',
    icon: <Wallet className="w-4 h-4" />,
    scope: 'offers' as const,
  },
  {
    id: 'route:/wealth',
    title: 'Private wealth',
    subtitle: 'Modulo private wealth',
    href: '/wealth',
    icon: <Command className="w-4 h-4" />,
    scope: 'offers' as const,
  },
] as const;

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function includesSearch(text: string, query: string): boolean {
  return normalizeText(text).includes(normalizeText(query));
}

function readStoredEntries(key: string, limit: number): StoredCommandEntry[] {
  const entries = readStorageJSON<StoredCommandEntry[]>(key, []);
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((entry) => entry && typeof entry.id === 'string' && typeof entry.title === 'string')
    .slice(0, limit);
}

function matchesScope(entryScope: EntryScope, selectedScope: CommandScope): boolean {
  if (selectedScope === 'all') return true;
  if (entryScope === 'all') return true;
  return entryScope === selectedScope;
}

function toClientResult(client: Cliente): StoredCommandEntry | null {
  if (!client.id) return null;
  return {
    id: `entity:client:${client.id}`,
    kind: 'entity',
    scope: 'clients',
    title: client.nome,
    subtitle: [client.email, client.telefone].filter(Boolean).join(' | '),
    searchText: [client.nome, client.cpfCnpj, client.email, client.telefone].filter(Boolean).join(' '),
    entityType: 'client',
    entityId: client.id,
    ts: Date.now(),
  };
}

function toProspectResult(prospect: Prospect): StoredCommandEntry | null {
  if (!prospect.id) return null;
  return {
    id: `entity:prospect:${prospect.id}`,
    kind: 'entity',
    scope: 'prospects',
    title: prospect.nome,
    subtitle: [prospect.email, prospect.telefone].filter(Boolean).join(' | '),
    searchText: [prospect.nome, prospect.cpfCnpj, prospect.email, prospect.telefone].filter(Boolean).join(' '),
    entityType: 'prospect',
    entityId: prospect.id,
    ts: Date.now(),
  };
}

function toAgendaResult(event: CalendarEvent): StoredCommandEntry | null {
  if (!event.id) return null;
  return {
    id: `entity:agenda:${event.id}`,
    kind: 'entity',
    scope: 'agendas',
    title: event.title,
    subtitle: event.start ? new Date(event.start).toLocaleString('pt-BR') : 'Evento',
    searchText: [event.title, event.description, event.internalNotes, event.location, event.attendees].filter(Boolean).join(' '),
    entityType: 'agenda',
    entityId: event.id,
    ts: Date.now(),
  };
}

function toOfferResult(offer: OfferReservation): StoredCommandEntry | null {
  if (!offer.id) return null;
  return {
    id: `entity:offer:${offer.id}`,
    kind: 'entity',
    scope: 'offers',
    title: offer.nomeAtivo,
    subtitle: offer.classeAtivo || 'Oferta',
    searchText: [offer.nomeAtivo, offer.classeAtivo, offer.observacoes].filter(Boolean).join(' '),
    entityType: 'offer',
    entityId: offer.id,
    ts: Date.now(),
  };
}

function getCommandIcon(scope: EntryScope): ReactNode {
  if (scope === 'clients') return <Users className="w-4 h-4" />;
  if (scope === 'prospects') return <UserPlus className="w-4 h-4" />;
  if (scope === 'agendas') return <Calendar className="w-4 h-4" />;
  if (scope === 'offers') return <Package className="w-4 h-4" />;
  return <Compass className="w-4 h-4" />;
}

function rowSubtitle(command: PaletteCommand): string | undefined {
  if (command.disabled && command.disabledReason) return command.disabledReason;
  return command.subtitle;
}

export default function CommandPalette({
  isOpen,
  onClose,
  triggerRef,
  uid,
  access,
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wasOpenRef = useRef(false);

  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<CommandScope>('all');
  const [selectedCommandId, setSelectedCommandId] = useState<string | null>(null);

  const [recentEntries, setRecentEntries] = useState<StoredCommandEntry[]>([]);
  const [pinnedEntries, setPinnedEntries] = useState<StoredCommandEntry[]>([]);

  const [clientData, setClientData] = useState<Cliente[]>([]);
  const [prospectData, setProspectData] = useState<Prospect[]>([]);
  const [agendaData, setAgendaData] = useState<CalendarEvent[]>([]);
  const [offerData, setOfferData] = useState<OfferReservation[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const recentStorageKey = useMemo(() => storageKeyForUser('ac_cmd_recent_v1', uid), [uid]);
  const pinnedStorageKey = useMemo(() => storageKeyForUser('ac_cmd_pins_v1', uid), [uid]);

  const executeStoredEntry = useCallback(
    (entry: StoredCommandEntry) => {
      if (entry.kind === 'route' && entry.href) {
        navigate(entry.href);
        return;
      }

      if (entry.kind === 'action' && entry.actionId) {
        if (entry.actionId === 'new-client') {
          navigate('/clientes?create=1');
          return;
        }
        if (entry.actionId === 'new-prospect') {
          navigate('/prospects?create=1');
          return;
        }
        if (entry.actionId === 'new-event') {
          navigate('/agendas?quickCreate=1');
          return;
        }
        if (entry.actionId === 'go-agendas-today') {
          navigate('/agendas?today=1');
        }
        return;
      }

      if (entry.kind === 'entity' && entry.entityType && entry.entityId) {
        if (entry.entityType === 'client') {
          navigate(`/clientes?open=${entry.entityId}`);
          return;
        }
        if (entry.entityType === 'prospect') {
          navigate(`/prospects?open=${entry.entityId}`);
          return;
        }
        if (entry.entityType === 'agenda') {
          navigate(`/agendas?event=${entry.entityId}`);
          return;
        }
        if (entry.entityType === 'offer') {
          navigate('/ofertas');
        }
      }
    },
    [navigate],
  );

  const trackRecentEntry = useCallback(
    (entry: StoredCommandEntry) => {
      setRecentEntries((previous) => {
        const next = [{ ...entry, ts: Date.now() }, ...previous.filter((item) => item.id !== entry.id)].slice(0, RECENT_LIMIT);
        writeStorageJSON(recentStorageKey, next);
        return next;
      });
    },
    [recentStorageKey],
  );

  const registerAndRun = useCallback(
    (entry: StoredCommandEntry) => {
      executeStoredEntry(entry);
      trackRecentEntry(entry);
      onClose();
    },
    [executeStoredEntry, onClose, trackRecentEntry],
  );

  const buildCommand = useCallback(
    (entry: StoredCommandEntry, section: CommandSection, icon?: ReactNode, index?: number): PaletteCommand => {
      const disabledByAccess =
        entry.kind === 'action' &&
        ((entry.actionId === 'new-client' && !access.canCreateClient) ||
          (entry.actionId === 'new-prospect' && !access.canCreateProspect) ||
          (entry.actionId === 'new-event' && !access.canCreateEvent));

      const listSuffix = typeof index === 'number' ? `:${index}` : '';
      return {
        id: entry.id,
        listId: `${section}:${entry.id}${listSuffix}`,
        section,
        scope: entry.scope,
        title: entry.title,
        subtitle: entry.subtitle,
        icon: icon ?? getCommandIcon(entry.scope),
        disabled: disabledByAccess,
        disabledReason: disabledByAccess ? 'Sem permissao para esta acao' : undefined,
        keywords: `${entry.title} ${entry.subtitle ?? ''} ${entry.searchText ?? ''} ${entry.scope}`,
        execute: () => {
          if (disabledByAccess) return;
          registerAndRun(entry);
        },
        persisted: entry,
      };
    },
    [access.canCreateClient, access.canCreateEvent, access.canCreateProspect, registerAndRun],
  );

  const loadSearchData = useCallback(async () => {
    const ownerUid = uid?.trim();
    if (!ownerUid) {
      setClientData([]);
      setProspectData([]);
      setAgendaData([]);
      setOfferData([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    setSearchError(null);

    try {
      const [clients, prospects, agendas, offers] = await Promise.all([
        clienteRepository.getAll(ownerUid),
        prospectRepository.getAll(ownerUid),
        calendarEventRepository.getAll(ownerUid),
        offerReservationRepository.getAll(ownerUid),
      ]);

      setClientData(clients);
      setProspectData(prospects);
      setAgendaData(agendas.filter((event) => event.status !== 'cancelled'));
      setOfferData(offers);
    } catch (error) {
      console.error('Erro ao carregar dados da busca global:', error);
      setSearchError('Nao foi possivel buscar resultados agora.');
    } finally {
      setSearchLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    setRecentEntries(readStoredEntries(recentStorageKey, RECENT_LIMIT));
    setPinnedEntries(readStoredEntries(pinnedStorageKey, PIN_LIMIT));
  }, [pinnedStorageKey, recentStorageKey]);

  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
      setQuery('');
      setScope('all');
      setSelectedCommandId(null);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      void loadSearchData();
      return;
    }

    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    }
  }, [isOpen, loadSearchData, triggerRef]);

  const navigationCommands = useMemo(() => {
    return NAVIGATION_CONFIG.map((route, index) =>
      buildCommand(
        {
          id: route.id,
          kind: 'route',
          scope: route.scope,
          title: route.title,
          subtitle: route.subtitle,
          href: route.href,
          ts: Date.now(),
        },
        'navigation',
        route.icon,
        index,
      ),
    );
  }, [buildCommand]);

  const actionCommands = useMemo(() => {
    const actions: Array<StoredCommandEntry & { icon: ReactNode }> = [
      {
        id: 'action:new-client',
        kind: 'action',
        scope: 'clients',
        title: 'Novo cliente',
        subtitle: 'Abrir fluxo atual de criacao de cliente',
        actionId: 'new-client',
        icon: <CirclePlus className="w-4 h-4" />,
        ts: Date.now(),
      },
      {
        id: 'action:new-prospect',
        kind: 'action',
        scope: 'prospects',
        title: 'Novo prospect',
        subtitle: 'Abrir fluxo atual de criacao de prospect',
        actionId: 'new-prospect',
        icon: <CirclePlus className="w-4 h-4" />,
        ts: Date.now(),
      },
      {
        id: 'action:new-event',
        kind: 'action',
        scope: 'agendas',
        title: 'Criar evento',
        subtitle: 'Abrir fluxo atual de criacao de evento',
        actionId: 'new-event',
        icon: <CirclePlus className="w-4 h-4" />,
        ts: Date.now(),
      },
      {
        id: 'action:go-agendas-today',
        kind: 'action',
        scope: 'agendas',
        title: 'Ir para agendas (hoje)',
        subtitle: 'Abrir tela de agendas no dia atual',
        actionId: 'go-agendas-today',
        icon: <Calendar className="w-4 h-4" />,
        ts: Date.now(),
      },
    ];

    return actions.map((entry, index) => buildCommand(entry, 'actions', entry.icon, index));
  }, [buildCommand]);

  const filteredPinned = useMemo(() => {
    return pinnedEntries
      .map((entry, index) => buildCommand(entry, 'pinned', undefined, index))
      .filter((command) => matchesScope(command.scope, scope))
      .filter((command) => (query ? includesSearch(command.keywords, query) : true));
  }, [buildCommand, pinnedEntries, query, scope]);

  const filteredRecent = useMemo(() => {
    return recentEntries
      .map((entry, index) => buildCommand(entry, 'recent', undefined, index))
      .filter((command) => matchesScope(command.scope, scope))
      .filter((command) => (query ? includesSearch(command.keywords, query) : true));
  }, [buildCommand, query, recentEntries, scope]);

  const filteredNavigation = useMemo(() => {
    return navigationCommands
      .filter((command) => matchesScope(command.scope, scope))
      .filter((command) => (query ? includesSearch(command.keywords, query) : true));
  }, [navigationCommands, query, scope]);

  const filteredActions = useMemo(() => {
    return actionCommands
      .filter((command) => matchesScope(command.scope, scope))
      .filter((command) => (query ? includesSearch(command.keywords, query) : true));
  }, [actionCommands, query, scope]);

  const resultGroups = useMemo(() => {
    if (!query.trim()) return [] as ScopeResultGroup[];

    const queryValue = query.trim();
    const groups: ScopeResultGroup[] = [];
    const includeScope = (groupScope: Exclude<CommandScope, 'all'>) => scope === 'all' || scope === groupScope;

    const clientResults = clientData
      .map(toClientResult)
      .filter((entry): entry is StoredCommandEntry => Boolean(entry))
      .filter((entry) => includesSearch(`${entry.title} ${entry.subtitle ?? ''} ${entry.searchText ?? ''}`, queryValue))
      .slice(0, RESULT_LIMIT)
      .map((entry, index) => buildCommand(entry, 'results', <Users className="w-4 h-4" />, index));

    const prospectResults = prospectData
      .map(toProspectResult)
      .filter((entry): entry is StoredCommandEntry => Boolean(entry))
      .filter((entry) => includesSearch(`${entry.title} ${entry.subtitle ?? ''} ${entry.searchText ?? ''}`, queryValue))
      .slice(0, RESULT_LIMIT)
      .map((entry, index) => buildCommand(entry, 'results', <UserPlus className="w-4 h-4" />, index));

    const agendaResults = agendaData
      .map(toAgendaResult)
      .filter((entry): entry is StoredCommandEntry => Boolean(entry))
      .filter((entry) => includesSearch(`${entry.title} ${entry.subtitle ?? ''} ${entry.searchText ?? ''}`, queryValue))
      .slice(0, RESULT_LIMIT)
      .map((entry, index) => buildCommand(entry, 'results', <Calendar className="w-4 h-4" />, index));

    const offerResults = offerData
      .map(toOfferResult)
      .filter((entry): entry is StoredCommandEntry => Boolean(entry))
      .filter((entry) => includesSearch(`${entry.title} ${entry.subtitle ?? ''} ${entry.searchText ?? ''}`, queryValue))
      .slice(0, RESULT_LIMIT)
      .map((entry, index) => buildCommand(entry, 'results', <Package className="w-4 h-4" />, index));

    if (includeScope('clients') && clientResults.length > 0) {
      groups.push({ title: 'Clientes', scope: 'clients', items: clientResults });
    }
    if (includeScope('prospects') && prospectResults.length > 0) {
      groups.push({ title: 'Prospects', scope: 'prospects', items: prospectResults });
    }
    if (includeScope('agendas') && agendaResults.length > 0) {
      groups.push({ title: 'Agendas', scope: 'agendas', items: agendaResults });
    }
    if (includeScope('offers') && offerResults.length > 0) {
      groups.push({ title: 'Ofertas', scope: 'offers', items: offerResults });
    }

    return groups;
  }, [agendaData, buildCommand, clientData, offerData, prospectData, query, scope]);

  const orderedCommands = useMemo(() => {
    return [
      ...filteredPinned,
      ...filteredRecent,
      ...filteredNavigation,
      ...filteredActions,
      ...resultGroups.flatMap((group) => group.items),
    ];
  }, [filteredActions, filteredNavigation, filteredPinned, filteredRecent, resultGroups]);

  useEffect(() => {
    if (!isOpen) return;
    if (orderedCommands.length === 0) {
      setSelectedCommandId(null);
      return;
    }

    if (selectedCommandId && orderedCommands.some((command) => command.listId === selectedCommandId)) {
      return;
    }
    setSelectedCommandId(orderedCommands[0].listId);
  }, [isOpen, orderedCommands, selectedCommandId]);

  const selectedIndex = useMemo(() => {
    if (!selectedCommandId) return -1;
    return orderedCommands.findIndex((command) => command.listId === selectedCommandId);
  }, [orderedCommands, selectedCommandId]);

  const togglePin = useCallback(
    (command: PaletteCommand) => {
      setPinnedEntries((previous) => {
        const exists = previous.some((entry) => entry.id === command.id);
        if (exists) {
          const next = previous.filter((entry) => entry.id !== command.id);
          writeStorageJSON(pinnedStorageKey, next);
          return next;
        }

        if (previous.length >= PIN_LIMIT) {
          toastError('Limite de 5 fixados atingido');
          return previous;
        }

        const next = [{ ...command.persisted, ts: Date.now() }, ...previous].slice(0, PIN_LIMIT);
        writeStorageJSON(pinnedStorageKey, next);
        return next;
      });
    },
    [pinnedStorageKey],
  );

  const handleInputKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (orderedCommands.length === 0) return;
        const nextIndex = selectedIndex < orderedCommands.length - 1 ? selectedIndex + 1 : 0;
        setSelectedCommandId(orderedCommands[nextIndex].listId);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (orderedCommands.length === 0) return;
        const prevIndex = selectedIndex > 0 ? selectedIndex - 1 : orderedCommands.length - 1;
        setSelectedCommandId(orderedCommands[prevIndex].listId);
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        const current = orderedCommands[selectedIndex];
        if (!current || current.disabled) return;
        current.execute();
      }
    },
    [onClose, orderedCommands, selectedIndex],
  );

  const noResultState = useMemo(() => {
    if (!query.trim()) return false;
    if (searchLoading || searchError) return false;
    return resultGroups.length === 0;
  }, [query, resultGroups.length, searchError, searchLoading]);

  const sectionLabelMap: Record<Exclude<CommandSection, 'results'>, string> = {
    pinned: 'Fixados',
    recent: 'Recentes',
    navigation: 'Navegacao',
    actions: 'Acoes',
  };

  const sectionGroups: Array<{ key: Exclude<CommandSection, 'results'>; items: PaletteCommand[] }> = [
    { key: 'pinned', items: filteredPinned },
    { key: 'recent', items: filteredRecent },
    { key: 'navigation', items: filteredNavigation },
    { key: 'actions', items: filteredActions },
  ];

  const renderCommandRow = (command: PaletteCommand, rowKey: string) => {
    const isSelected = selectedCommandId === command.listId;
    const isPinned = pinnedEntries.some((entry) => entry.id === command.id);
    const subtitle = rowSubtitle(command);

    return (
      <div
        key={rowKey}
        className="px-3 py-1.5 flex items-start gap-2"
        style={{
          backgroundColor: isSelected ? 'var(--color-gold-bg)' : 'transparent',
          borderBottom: '1px solid var(--color-border-subtle)',
        }}
        onMouseEnter={() => setSelectedCommandId(command.listId)}
      >
        <button
          type="button"
          aria-disabled={command.disabled}
          onClick={() => command.execute()}
          className={`flex-1 text-left min-w-0 ${command.disabled ? 'opacity-65' : ''}`}
          title={command.disabledReason || command.subtitle}
        >
          <div className="flex items-start gap-2 min-w-0">
            <span className="mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {command.icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                {command.title}
              </p>
              {subtitle && (
                <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => togglePin(command)}
          className="p-1 rounded hover-light"
          aria-label={isPinned ? 'Desafixar comando' : 'Fixar comando'}
          title={isPinned ? 'Desafixar comando' : 'Fixar comando'}
        >
          {isPinned ? (
            <PinOff className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />
          ) : (
            <Pin className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
          )}
        </button>
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Command Palette" size="lg">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Buscar comandos, clientes, prospects, agendas..."
            className="w-full px-3 py-2 rounded-lg focus-gold"
            style={{
              backgroundColor: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
            aria-label="Buscar no command palette"
          />
          <span
            className="px-2 py-1 rounded text-xs"
            style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
          >
            ESC
          </span>
        </div>

        <Tabs
          items={SCOPE_ITEMS.map((item) => ({ value: item.value, label: item.label }))}
          value={scope}
          onChange={(value) => {
            if (value === 'all' || value === 'clients' || value === 'prospects' || value === 'agendas' || value === 'offers') {
              setScope(value);
            }
          }}
          size="sm"
        />

        <div
          className="rounded-lg max-h-[52vh] overflow-y-auto"
          style={{ border: '1px solid var(--color-border-subtle)' }}
        >
          {sectionGroups.map((section) =>
            section.items.length > 0 ? (
              <div key={section.key}>
                <div
                  className="px-3 py-2 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface-2)' }}
                >
                  {sectionLabelMap[section.key]}
                </div>
                {section.items.map((command) => renderCommandRow(command, `${section.key}-${command.listId}`))}
              </div>
            ) : null,
          )}

          {query.trim() && (
            <div>
              <div
                className="px-3 py-2 text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface-2)' }}
              >
                Resultados
              </div>

              {searchLoading && (
                <div className="px-4 py-6">
                  <div
                    className="w-6 h-6 rounded-full animate-spin border-2 border-t-transparent"
                    style={{ borderColor: 'var(--color-gold)' }}
                  />
                  <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                    Buscando resultados...
                  </p>
                </div>
              )}

              {!searchLoading && searchError && (
                <div className="px-4 py-5">
                  <p className="text-sm" style={{ color: 'var(--color-danger)' }}>
                    {searchError}
                  </p>
                  <Button variant="ghost" size="sm" className="mt-2" onClick={() => void loadSearchData()}>
                    Tentar novamente
                  </Button>
                </div>
              )}

              {!searchLoading &&
                !searchError &&
                resultGroups.map((group) => (
                  <div key={group.scope}>
                    <div className="px-3 py-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {group.title}
                    </div>
                    {group.items.map((command) => renderCommandRow(command, `result-${group.scope}-${command.listId}`))}
                  </div>
                ))}

              {noResultState && (
                <div className="px-4 py-5">
                  <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                    Nenhum resultado para "{query}".
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    Troque o escopo ou abra Clientes e Prospects para refinar os filtros.
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/clientes')}>
                      Abrir Clientes
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/prospects')}>
                      Abrir Prospects
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <span className="flex items-center gap-1">
            <Clock3 className="w-3.5 h-3.5" />
            Recentes: {recentEntries.length} | Fixados: {pinnedEntries.length}
          </span>
          <span>Use setas para navegar e Enter para executar</span>
        </div>
      </div>
    </Modal>
  );
}
