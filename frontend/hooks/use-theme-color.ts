import { LightColors, DarkColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof LightColors & keyof typeof DarkColors
) {
  const theme = (useColorScheme() === 'dark' ? 'dark' : 'light') as 'light' | 'dark';
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return theme === 'dark' ? DarkColors[colorName] : LightColors[colorName];
  }
}
