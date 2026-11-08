/**
 * Lykiva ortak arayüz parçaları. Değerler Design canvas'ındaki ekranlardan alındı.
 */
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import type { AvatarTone } from '@/data/ornek';
import { colors, fontFamily, minTouchTarget, radius, space } from '@/theme';

/* ---------- Kart ---------- */
export function Card({ children, style, dark }: { children: ReactNode; style?: StyleProp<ViewStyle>; dark?: boolean }) {
  return <View style={[styles.card, dark && styles.cardDark, style]}>{children}</View>;
}

/* ---------- Avatar ---------- */
const toneMap: Record<AvatarTone, { bg: string; fg: string }> = {
  sea: { bg: colors.seaSoft, fg: colors.seaInk },
  terra: { bg: colors.terraSoft, fg: colors.terraInk },
  sand: { bg: colors.sand, fg: colors.sandInk },
  green: { bg: '#CFE0D0', fg: '#2E4A33' },
  ink: { bg: colors.ink, fg: colors.ground },
};

export function Avatar({
  initials,
  tone = 'sea',
  size = 40,
  ring,
  square,
  border,
}: {
  initials: string;
  tone?: AvatarTone;
  size?: number;
  ring?: string;
  square?: boolean;
  border?: string;
}) {
  const t = toneMap[tone];
  const inner = (
    <View
      style={{
        width: ring ? size - 8 : size,
        height: ring ? size - 8 : size,
        borderRadius: square ? size * 0.3 : size,
        backgroundColor: t.bg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: border ? 2 : 0,
        borderColor: border,
      }}>
      <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: Math.max(10, size * 0.32), color: t.fg }}>{initials}</Txt>
    </View>
  );
  if (!ring) return inner;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size,
        borderWidth: 2.5,
        borderColor: ring,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {inner}
    </View>
  );
}

export function AvatarStack({ items, size = 28, bg = colors.surface }: { items: { initials: string; tone: AvatarTone }[]; size?: number; bg?: string }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {items.map((p, i) => (
        <View key={p.initials + i} style={{ marginLeft: i === 0 ? 0 : -8 }}>
          <Avatar initials={p.initials} tone={p.tone} size={size} border={bg} />
        </View>
      ))}
    </View>
  );
}

/* ---------- Çip ---------- */
export function Chip({
  label,
  selected,
  onPress,
  role = 'button',
  icon,
  tone = 'ink',
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  role?: 'button' | 'radio' | 'tab' | 'checkbox';
  icon?: IconName;
  tone?: 'ink' | 'sea';
}) {
  const onBg = tone === 'sea' ? colors.seaSoft : colors.ink;
  const onFg = tone === 'sea' ? colors.seaInk : colors.ground;
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={role === 'checkbox' || role === 'radio' ? { checked: !!selected } : { selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? { backgroundColor: onBg, borderColor: onBg } : null,
        pressed && { opacity: 0.75 },
      ]}>
      {icon ? <Icon name={icon} size={15} color={selected ? onFg : colors.ink} strokeWidth={2} /> : null}
      <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: selected ? onFg : colors.ink }}>{label}</Txt>
    </Pressable>
  );
}

/* ---------- Butonlar ---------- */
type ButtonVariant = 'primary' | 'outline' | 'dark' | 'night' | 'nightOutline';

export function Button({
  label,
  onPress,
  href,
  variant = 'primary',
  icon,
  style,
  big,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  href?: Href;
  variant?: ButtonVariant;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  big?: boolean;
  disabled?: boolean;
}) {
  const v = buttonVariants[variant];
  return (
    <Pressable
      accessibilityRole={href ? 'link' : 'button'}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        onPress?.();
        if (href) router.push(href);
      }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: v.bg, borderColor: v.border ?? v.bg, height: big ? 60 : 54 },
        pressed && { opacity: 0.85 },
        disabled && { opacity: 0.55 },
        style,
      ]}>
      {icon ? <Icon name={icon} size={20} color={v.fg} strokeWidth={icon === 'play' || icon === 'stop' ? 1 : 1.8} /> : null}
      <Txt style={{ fontFamily: big ? fontFamily.display : fontFamily.bodyBold, fontSize: big ? 20 : 15, color: v.fg }}>{label}</Txt>
    </Pressable>
  );
}

const buttonVariants: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.terra, fg: '#FFFFFF' },
  outline: { bg: 'transparent', fg: colors.ink, border: colors.ink },
  dark: { bg: colors.ink, fg: colors.ground },
  night: { bg: colors.night.accent, fg: colors.night.ground },
  nightOutline: { bg: 'transparent', fg: colors.night.text, border: '#3A4842' },
};

/* ---------- İstatistik ---------- */
export function Stat({
  label,
  value,
  unit,
  size = 22,
  color = colors.ink,
  muted = colors.inkMuted,
  valueStyle,
}: {
  label: string;
  value: string;
  unit?: string;
  size?: number;
  color?: string;
  muted?: string;
  valueStyle?: StyleProp<TextStyle>;
}) {
  return (
    <View>
      <Txt style={{ fontSize: 11, fontFamily: fontFamily.body, color: muted }}>{label}</Txt>
      <Txt style={[{ fontFamily: fontFamily.display, fontSize: size, color, letterSpacing: -0.3 }, valueStyle]}>
        {value}
        {unit ? <Txt style={{ fontFamily: fontFamily.bodyMedium, fontSize: Math.round(size * 0.55), color: muted }}> {unit}</Txt> : null}
      </Txt>
    </View>
  );
}

/* ---------- Bölüm başlığı ---------- */
export function SectionHeader({ title, action, onAction, dark }: { title: string; action?: string; onAction?: () => void; dark?: boolean }) {
  return (
    <View style={styles.sectionHeader}>
      <Txt style={{ fontFamily: fontFamily.bodyBold, fontSize: 16, color: dark ? colors.night.text : colors.ink }}>{title}</Txt>
      {action ? (
        <Pressable accessibilityRole="link" onPress={onAction} hitSlop={10}>
          <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.terra }}>{action}</Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Label({ children, dark }: { children: string; dark?: boolean }) {
  return (
    <Txt variant="label" color={dark ? colors.night.textMuted : colors.inkMuted} style={{ marginBottom: space.sm }}>
      {children}
    </Txt>
  );
}

/* ---------- Satır (ikon + başlık + alt başlık + ok) ---------- */
export function ListRow({
  icon,
  iconTone = 'terra',
  caption,
  title,
  href,
  onPress,
  right,
}: {
  icon: IconName;
  iconTone?: AvatarTone;
  caption?: string;
  title: string;
  href?: Href;
  onPress?: () => void;
  right?: ReactNode;
}) {
  const t = toneMap[iconTone];
  return (
    <Pressable
      accessibilityRole={href ? 'link' : 'button'}
      onPress={() => {
        onPress?.();
        if (href) router.push(href);
      }}
      style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.8 }]}>
      <View style={[styles.listIcon, { backgroundColor: t.bg }]}>
        <Icon name={icon} size={22} color={t.fg} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {caption ? <Txt variant="small">{caption}</Txt> : null}
        <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 15 }} numberOfLines={1}>
          {title}
        </Txt>
      </View>
      {right ?? <Icon name="chevron" size={20} color={colors.inkMuted} strokeWidth={2} />}
    </Pressable>
  );
}

/* ---------- Anahtar (switch) satırı ---------- */
export function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
  dark,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  dark?: boolean;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14, color: dark ? colors.night.text : colors.ink }}>{title}</Txt>
        {subtitle ? <Txt variant="small" color={dark ? colors.night.textMuted : colors.inkMuted}>{subtitle}</Txt> : null}
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#C9BFAE', true: colors.sea }}
        thumbColor="#FFFFFF"
        ios_backgroundColor="#C9BFAE"
      />
    </View>
  );
}

/* ---------- Tarih rozeti ---------- */
export function DateBadge({ month, day, tone = 'terra' }: { month: string; day: string; tone?: 'terra' | 'sea' | 'night' }) {
  const bg = tone === 'sea' ? colors.seaSoft : tone === 'night' ? colors.night.accent : colors.terraSoft;
  const fg = tone === 'sea' ? colors.seaInk : tone === 'night' ? colors.night.ground : colors.terraInk;
  return (
    <View style={[styles.dateBadge, { backgroundColor: bg }]}>
      <Txt style={{ fontSize: 10, fontFamily: fontFamily.bodyBold, color: fg }}>{month}</Txt>
      <Txt style={{ fontFamily: fontFamily.displayHeavy, fontSize: 22, lineHeight: 24, color: fg }}>{day}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  cardDark: { backgroundColor: colors.night.surface, borderColor: colors.night.line },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  button: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: space.sm,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.ground,
    minHeight: minTouchTarget + 20,
  },
  listIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  dateBadge: { width: 48, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
