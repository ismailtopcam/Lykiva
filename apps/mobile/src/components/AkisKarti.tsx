/**
 * Akıştaki tek aktivite kartı (gerçek veri). Tasarım: Akış ekranındaki gönderi kartı.
 */
import { ACTIVITY_LABELS } from '@lykiva/shared';
import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { akisZamani, baslik, izi, kartIstatistikleri, turSimgesi, type AkisOgesi } from '@/akis/akis';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { TopoMap } from '@/components/map/TopoMap';
import { Txt } from '@/components/Txt';
import { Avatar, Card, Stat } from '@/components/ui';
import { basHarfler, grupRengi } from '@/grup/gruplar';
import { colors, fontFamily, space } from '@/theme';

const GORUNURLUK: Record<AkisOgesi['visibility'], string> = {
  public: 'herkese açık',
  followers: 'takipçilere',
  groups: 'gruplara',
  private: 'sadece sen',
};

type Props = {
  o: AkisOgesi;
  onBegen: (o: AkisOgesi) => void;
};

function AkisKartiIc({ o, onBegen }: Props) {
  const iz = izi(o.track);
  const s = kartIstatistikleri(o);
  const ad = baslik(o);
  const kisiye = () => (o.mine ? router.push('/profil') : router.push({ pathname: '/kisi/[id]', params: { id: o.owner_id } }));
  const aktiviteye = () => router.push({ pathname: '/aktivite/[id]', params: { id: o.id } });

  return (
    <Card style={styles.post}>
      <View style={styles.head}>
        <Pressable accessibilityRole="link" accessibilityLabel={`${o.owner_name} profili`} onPress={kisiye} hitSlop={4}>
          <Avatar initials={basHarfler(o.owner_name)} tone={grupRengi(o.owner_id)} />
        </Pressable>
        <Pressable accessibilityRole="link" onPress={kisiye} style={{ flex: 1, minWidth: 0 }}>
          <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14 }} numberOfLines={1}>
            {o.mine ? 'Sen' : o.owner_name}
          </Txt>
          <Txt variant="small" numberOfLines={1}>
            {akisZamani(o.started_at)}
            {o.mine ? ` · ${GORUNURLUK[o.visibility]}` : ''}
          </Txt>
        </Pressable>
        <View style={styles.typeBadge}>
          <Icon name={turSimgesi(o.activity)} size={15} color={colors.seaInk} strokeWidth={2} />
          <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 12, color: colors.seaInk }}>{ACTIVITY_LABELS[o.activity]}</Txt>
        </View>
      </View>

      <Pressable accessibilityRole="link" accessibilityLabel={`${ad}, ${s.km} kilometre`} onPress={aktiviteye}>
        <Txt style={styles.title}>{ad}</Txt>
        <View style={styles.statRow}>
          <Stat label="Mesafe" value={s.km} unit="km" size={18} />
          <Stat label="Tırmanış" value={s.tirmanis} unit="m" size={18} />
          <Stat label="Süre" value={s.sure} size={18} />
          <Stat label="Ort. hız" value={s.hiz} unit="km/sa" size={18} />
        </View>
        {iz.length > 1 ? (
          <TopoMap
            route={iz}
            interactive={false}
            markers={[
              { id: 's', coord: iz[0], kind: 'start' },
              { id: 'e', coord: iz[iz.length - 1], kind: 'end' },
            ]}
            padding={{ top: 24, bottom: 24 }}
            style={{ height: 176 }}
            accessibilityLabel={`${ad} rotasının haritası`}
          />
        ) : null}
      </Pressable>

      {o.stop_count ? (
        <View style={styles.meta}>
          <Txt variant="small">{o.stop_count} mola</Txt>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: o.liked }}
          accessibilityLabel={`${o.liked ? 'Beğeniyi geri al' : 'Beğen'}, ${o.like_count} beğeni`}
          onPress={() => onBegen(o)}
          style={styles.action}>
          <Icon name="heart" size={21} color={o.liked ? colors.terra : colors.ink} />
          <Txt style={[styles.actionText, o.liked && { color: colors.terra }]}>{o.like_count}</Txt>
        </Pressable>
        <Pressable accessibilityRole="link" accessibilityLabel={`${o.comment_count} yorum`} onPress={aktiviteye} style={styles.action}>
          <Icon name="chat" size={21} />
          <Txt style={styles.actionText}>{o.comment_count}</Txt>
        </Pressable>
        <View style={{ flex: 1 }} />
        {o.mine ? (
          <IconButton icon="share" label="Paylaş" onPress={() => router.push({ pathname: '/aktivite/[id]/paylas', params: { id: o.id } })} />
        ) : null}
      </View>
    </Card>
  );
}

export const AkisKarti = memo(AkisKartiIc);

const styles = StyleSheet.create({
  post: { marginHorizontal: space.md, marginBottom: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, paddingBottom: 10 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: colors.seaSoft },
  title: { fontFamily: fontFamily.display, fontSize: 21, paddingHorizontal: 14, paddingBottom: 10, color: colors.ink },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 4 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 10 },
  actionText: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.ink },
});
