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
  | 'trophy'
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
  | 'gauge'
  | 'camera'
  | 'download'
  | 'link'
  | 'send'
  | 'rotate'
  | 'video'
  | 'undo'
  | 'image'
  | 'weather'
  | 'more'
  | 'target'
  | 'flag'
  | 'medal'
  | 'flame'
  | 'sunrise'
  | 'star';

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
    case 'target':
      return (
        <>
          <Circle cx={12} cy={12} r={9} {...p} />
          <Circle cx={12} cy={12} r={5} {...p} />
          <Circle cx={12} cy={12} r={1.2} fill={color} />
        </>
      );
    case 'flag':
      return <Path d="M5 21V4M5 4h12l-2.5 4L17 12H5" {...p} />;
    case 'medal':
      return (
        <>
          <Path d="M8 3l2.5 6M16 3l-2.5 6" {...p} />
          <Circle cx={12} cy={15} r={6} {...p} />
          <Path d="M12 12.5l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2-1.45-1.4 2-.3z" {...p} strokeWidth={1.2} />
        </>
      );
    case 'flame':
      return <Path d="M12 21c-3.9 0-6.5-2.6-6.5-6 0-3.2 2.3-5 3.5-7.5.6 1.5 1.5 2.5 2.5 3 0-3 1.5-5.5 3-7.5.5 3 4 5.5 4 10.5 0 4.4-2.6 7.5-6.5 7.5z" {...p} />;
    case 'sunrise':
      return (
        <>
          <Path d="M7 17a5 5 0 0 1 10 0M3 17h18M5 21h14" {...p} />
          <Path d="M12 4v4M5.6 8.6l1.8 1.8M18.4 8.6l-1.8 1.8M2.5 13.5H4.5M19.5 13.5h2" {...p} />
        </>
      );
    case 'star':
      return <Path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" {...p} />;
    case 'trophy':
      return <Path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3.3 3M17 6h3v1a3 3 0 0 1-3.3 3M12 14v4M8 20h8" {...p} />;
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
    case 'weather':
      return (
        <>
          <Circle cx={9} cy={9} r={3.2} {...p} />
          <Path d="M9 2.5v1.3M3.8 4.3l.9.9M2.5 9h1.3M14.2 4.3l-.9.9" {...p} />
          <Path d="M8 20h9.5a3.5 3.5 0 0 0 .3-7 4.6 4.6 0 0 0-8.8.9A3 3 0 0 0 8 20z" {...p} />
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
    case 'camera':
      return (
        <>
          <Rect x={3} y={7} width={18} height={13} rx={2} {...p} />
          <Circle cx={12} cy={13.5} r={3.5} {...p} />
          <Path d="M8 7l2-3h4l2 3" {...p} />
        </>
      );
    case 'download':
      return <Path d="M12 4v11M7 10l5 5 5-5M5 20h14" {...p} />;
    case 'link':
      return <Path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1" {...p} />;
    case 'send':
      return <Path d="M4 12l16-8-6 16-3-6z" {...p} />;
    case 'rotate':
      return <Path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4" {...p} />;
    case 'video':
      return (
        <>
          <Rect x={3} y={6} width={13} height={12} rx={2} {...p} />
          <Path d="M16 10l5-3v10l-5-3z" {...p} />
        </>
      );
    case 'undo':
      return <Path d="M9 6l-5 5 5 5M4 11h10a5 5 0 0 1 0 10h-4" {...p} />;
    case 'image':
      return (
        <>
          <Rect x={3} y={4} width={18} height={16} rx={2} {...p} />
          <Circle cx={9} cy={10} r={2} {...p} />
          <Path d="M21 16l-5-5-9 9" {...p} />
        </>
      );
    case 'more':
      return (
        <>
          <Circle cx={5} cy={12} r={1.8} fill={color} />
          <Circle cx={12} cy={12} r={1.8} fill={color} />
          <Circle cx={19} cy={12} r={1.8} fill={color} />
        </>
      );
  }
}
