import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookOpen, LayoutGrid, LogOut, NotebookPen, Receipt, type LucideIcon } from 'lucide-react-native';
import { PressableScale, Text, haptic, minTarget, radius, space, useTheme } from '@vase/ui';
import { useSession } from '@/lib/session';

const ICONOS: Record<string, { Icono: LucideIcon; titulo: string; roles?: readonly string[] }> = {
  salon: { Icono: LayoutGrid, titulo: 'Salón' },
  pedido: { Icono: NotebookPen, titulo: 'Pedido' },
  cobro: { Icono: Receipt, titulo: 'Cobro' },
  // La carta la editan quienes manejan el local.
  menu: { Icono: BookOpen, titulo: 'Carta', roles: ['admin', 'encargado'] },
};

/**
 * Misma navegación, distinta forma: barra inferior translúcida en celular y barra lateral en
 * tablet/escritorio. Cambiar de pestaña no se anima (se usa decenas de veces por turno).
 */
// El tipo sale de la API pública de <Tabs>, sin depender de rutas internas de la librería.
type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

export function AppTabBar({ state, navigation }: TabBarProps) {
  const { colors, sizeClass } = useTheme();
  const insets = useSafeAreaInsets();
  const usuario = useSession((s) => s.usuario);
  const salir = useSession((s) => s.salir);
  const lateral = sizeClass !== 'compact';

  const items = state.routes.map((route, index) => {
    const meta = ICONOS[route.name];
    if (!meta || (meta.roles && !meta.roles.includes(usuario?.rol ?? ''))) return null;
    const activo = state.index === index;
    const { Icono, titulo } = meta;
    const ir = () => {
      const evento = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!activo && !evento.defaultPrevented) { haptic.seleccion(); navigation.navigate(route.name, route.params); }
    };
    if (lateral) {
      return (
        <PressableScale
          key={route.key}
          onPress={ir}
          scaleTo={0.98}
          accessibilityLabel={titulo}
          accessibilityState={{ selected: activo }}
          style={[styles.sideItem, activo && { backgroundColor: colors.tintSoft }]}
        >
          <Icono size={22} color={activo ? colors.tint : colors.labelSecondary} strokeWidth={activo ? 2.4 : 2} />
          {sizeClass === 'expanded' ? <Text variant="headline" color={activo ? 'tint' : 'label'} weight={activo ? '600' : '500'}>{titulo}</Text> : null}
        </PressableScale>
      );
    }
    return (
      <PressableScale key={route.key} onPress={ir} scaleTo={0.94} accessibilityLabel={titulo} accessibilityState={{ selected: activo }} style={styles.bottomItem}>
        <Icono size={24} color={activo ? colors.tint : colors.labelSecondary} strokeWidth={activo ? 2.4 : 2} />
        <Text variant="caption" weight="600" color={activo ? 'tint' : 'secondary'}>{titulo}</Text>
      </PressableScale>
    );
  });

  if (lateral) {
    const ancho = sizeClass === 'expanded' ? 248 : 84;
    return (
      <View style={[styles.side, { width: ancho, backgroundColor: colors.surface, borderRightColor: colors.separator, paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg }]}>
        <View style={styles.sideTop}>
          {sizeClass === 'expanded' ? <Text variant="title3" weight="700" style={styles.brand}>Vase Rest</Text> : null}
          <View style={styles.sideItems}>{items}</View>
        </View>
        <PressableScale onPress={salir} scaleTo={0.98} accessibilityLabel="Cerrar sesión" style={styles.sideItem}>
          <LogOut size={22} color={colors.labelSecondary} />
          {sizeClass === 'expanded' ? (
            <View style={{ flex: 1 }}>
              <Text variant="subhead" weight="600" numberOfLines={1}>{usuario?.nombre ?? 'Cuenta'}</Text>
              <Text variant="footnote" color="secondary">Cerrar sesión</Text>
            </View>
          ) : null}
        </PressableScale>
      </View>
    );
  }

  return (
    <View style={[styles.bottom, { paddingBottom: insets.bottom }]}>
      <BlurView intensity={60} tint={colors.blurTint} style={StyleSheet.absoluteFill} />
      <View style={[styles.hairline, { backgroundColor: colors.separator }]} />
      <View style={styles.bottomRow}>{items}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  hairline: { position: 'absolute', top: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth },
  bottomRow: { flexDirection: 'row', paddingTop: space.sm },
  bottomItem: { flex: 1, minHeight: minTarget + 4, alignItems: 'center', justifyContent: 'center', gap: 2 },
  side: { borderRightWidth: StyleSheet.hairlineWidth, justifyContent: 'space-between', paddingHorizontal: space.md },
  sideTop: { gap: space['3xl'] },
  brand: { paddingHorizontal: space.md },
  sideItems: { gap: space.xs },
  sideItem: { minHeight: minTarget + 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md, paddingHorizontal: space.md, borderRadius: radius.md, borderCurve: 'continuous' },
});
