import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme';

/**
 * Tasarımdaki çizgi ikonlar (24×24, stroke). Yeni ikon eklemek için
 * `paths` sözlüğüne bir giriş eklemek yeterli.
 */
export type IconName =
  | 'home'
  | 'compass'
  | 'plus'
  | 'users'
  | 'user'
  | 'search'
  | 'bell'
  | 'chat'
  | 'back'
  | 'close'
  | 'chevron'
  | 'share'
  | 'heart'
  | 'bookmark'
  | 'route'
  | 'pin'
  | 'calendar'
  | 'clock'
  | 'mountain'
  | 'bike'
  | 'run'
  | 'walk'
  | 'pause'
  | 'play'
  | 'stop'
  | 'layers'
  | 'lock'
  | 'shield'
  | 'gauge';

type Props = { name: IconName; size?: number; color?: string; strokeWidth?: number };

export function Icon({ name, size = 22, color = colors.ink, strokeWidth = 1.8 }: Props) {
  const common = {
    fill: 'none',
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      {render(name, common, color)}
    </Svg>
  );
}

function render(name: IconName, p: Record<string, unknown>, color: string) {
  switch (name) {
    case 'home':
      return <Path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" {...p} />;
    case 'compass':
      return (
        <>
          <Circle cx={12} cy={12} r={9} {...p} />
          <Path d="M15.5 8.5l-2 5-5 2 2-5z" {...p} />
        </>
      );
    case 'plus':
      return <Path d="M12 5v14M5 12h14" {...p} />;
    case 'users':
      return (
        <>
          <Circle cx={9} cy={8} r={3.5} {...p} />
          <Path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.5a6.5 6.5 0 0 1 3.5 5.5" {...p} />
        </>
      );
    case 'user':
      return (
        <>
          <Circle cx={12} cy={8} r={4} {...p} />
          <Path d="M4 21a8 8 0 0 1 16 0" {...p} />
        </>
      );
    case 'search':
      return (
        <>
          <Circle cx={11} cy={11} r={7} {...p} />
          <Path d="M20 20l-4-4" {...p} />
        </>
      );
    case 'bell':
      return <Path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0" {...p} />;
    case 'chat':
      return <Path d="M4 5h16v11H9l-5 4z" {...p} />;
    case 'back':
      return <Path d="M15 5l-7 7 7 7" {...p} />;
    case 'close':
      return <Path d="M6 6l12 12M18 6L6 18" {...p} />;
    case 'chevron':
      return <Path d="M9 5l7 7-7 7" {...p} />;
    case 'share':
      return <Path d="M12 3v12M7 8l5-5 5 5M5 13v7h14v-7" {...p} />;
    case 'heart':
      return <Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" {...p} />;
    case 'bookmark':
      return <Path d="M6 3h12v18l-6-4-6 4z" {...p} />;
    case 'route':
      return (
        <>
          <Circle cx={6} cy={18} r={2.5} {...p} />
          <Circle cx={18} cy={6} r={2.5} {...p} />
          <Path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" {...p} />
        </>
      );
    case 'pin':
      return (
        <>
          <Path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" {...p} />
          <Circle cx={12} cy={10} r={2.5} {...p} />
        </>
      );
    case 'calendar':
      return (
        <>
          <Rect x={4} y={5} width={16} height={16} rx={2} {...p} />
          <Path d="M4 10h16M9 3v4M15 3v4" {...p} />
        </>
      );
    case 'clock':
      return (
        <>
          <Circle cx={12} cy={12} r={9} {...p} />
          <Path d="M12 7v5l3 2" {...p} />
        </>
      );
    case 'mountain':
      return <Path d="M3 20l6-10 4 6 3-4 5 8z" {...p} />;
    case 'bike':
      return (
        <>
          <Circle cx={6} cy={16} r={3.5} {...p} />
          <Circle cx={18} cy={16} r={3.5} {...p} />
          <Path d="M6 16l4-7h5l3 7M10 9l3 7M13 6h3" {...p} />
        </>
      );
    case 'run':
      return (
        <>
          <Circle cx={15} cy={4.5} r={1.8} {...p} />
          <Path d="M8 21l3-6 3 2v5M6 12l3-4 5 1 2 4 3 1" {...p} />
        </>
      );
    case 'walk':
      return (
        <>
          <Circle cx={12} cy={4.5} r={1.8} {...p} />
          <Path d="M12 8v6l-3 7M12 14l3 7M8 12l4-4 4 4" {...p} />
        </>
      );
    case 'pause':
      return <Path d="M9 5v14M15 5v14" {...p} />;
    case 'play':
      return <Path d="M7 4l13 8-13 8z" fill={color} />;
    case 'stop':
      return <Rect x={5} y={5} width={14} height={14} rx={2} fill={color} />;
    case 'layers':
      return <Path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5" {...p} />;
    case 'lock':
      return (
        <>
          <Rect x={5} y={11} width={14} height={10} rx={2} {...p} />
          <Path d="M8 11V8a4 4 0 0 1 8 0v3" {...p} />
        </>
      );
    case 'shield':
      return <Path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" {...p} />;
    case 'gauge':
      return <Path d="M4 18a8 8 0 1 1 16 0M12 18l4-5" {...p} />;
  }
}
