import { Tabs } from 'expo-router';
import { AppTabBar } from '@/components/AppTabBar';
import { useTheme } from '@vase/ui';

export default function AppLayout() {
  const { sizeClass } = useTheme();
  return (
    <Tabs
      initialRouteName="salon"
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{ headerShown: false, animation: 'none', tabBarPosition: sizeClass === 'compact' ? 'bottom' : 'left' }}
    >
      <Tabs.Screen name="salon" options={{ title: 'Salón' }} />
      <Tabs.Screen name="pedido" options={{ title: 'Pedido' }} />
      <Tabs.Screen name="cobro" options={{ title: 'Cobro' }} />
      <Tabs.Screen name="menu" options={{ title: 'Carta' }} />
      <Tabs.Screen name="salida" options={{ title: 'Salida' }} />
    </Tabs>
  );
}
