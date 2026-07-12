import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { apiFetch } from './api';
import { useAuth } from './AuthContext';
import { RootParamList } from './types';

type HomePageNavigationProp = StackNavigationProp<RootParamList, 'Home'>;

type SensorRecord = {
  _id?: string;
  time?: string;
  timestamp?: string;
  airQuality?: string;
  ppm?: number;
  co2_ppm?: number;
  co_ppm?: number;
};

type EnvironmentRecord = {
  _id?: string;
  time?: string;
  timestamp?: string;
  temp?: number;
  humidity?: number;
};

const qualityColor = (quality?: string) => {
  const normalized = (quality || '').toUpperCase();
  if (normalized.includes('GOOD')) return '#22c55e';
  if (normalized.includes('DANGER') || normalized.includes('BAD')) return '#ef4444';
  return '#f59e0b';
};

const qualityText = (quality?: string) => {
  const normalized = (quality || '').toUpperCase();
  if (normalized.includes('GOOD')) return 'Ổn';
  if (normalized.includes('DANGER') || normalized.includes('BAD')) return 'Nguy hiểm';
  if (normalized.includes('WARNING')) return 'Không ổn';
  return quality || '--';
};

const formatNumber = (value?: number, suffix = '') => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--';
  return `${Math.round(value * 10) / 10}${suffix}`;
};

const getRecordDate = (record?: { timestamp?: string; time?: string } | null) => {
  const rawTime = record?.timestamp || record?.time;
  if (!rawTime) return null;

  const date = new Date(rawTime);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getPpmValue = (record?: SensorRecord | null) => {
  if (!record) return undefined;
  if (typeof record.ppm === 'number') return record.ppm;

  const legacyValues = [record.co2_ppm, record.co_ppm].filter(
    (value): value is number => typeof value === 'number' && !Number.isNaN(value),
  );
  return legacyValues.length > 0 ? Math.max(...legacyValues) : undefined;
};

const ppmColor = (ppm?: number) => {
  if (typeof ppm !== 'number' || Number.isNaN(ppm)) return '#64748b';
  if (ppm > 1100) return '#ef4444';
  if (ppm >= 900) return '#f59e0b';
  return '#22c55e';
};

const isAuthError = (error: unknown) =>
  error instanceof Error &&
  (error.message.includes('Cần đăng nhập') ||
    error.message.includes('401') ||
    error.message.toLowerCase().includes('unauthorized'));

const HomePage: React.FC = () => {
  const [isFire, setIsFire] = useState(false);
  const [latestSensor, setLatestSensor] = useState<SensorRecord | null>(null);
  const [latestEnvironment, setLatestEnvironment] = useState<EnvironmentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation<HomePageNavigationProp>();
  const { logout, token, user } = useAuth();

  const lastUpdated = useMemo(() => {
    const dates = [getRecordDate(latestSensor), getRecordDate(latestEnvironment)].filter(
      (date): date is Date => date !== null,
    );
    if (dates.length === 0) return 'Chưa có dữ liệu';

    const newestDate = dates.reduce((newest, date) => (date > newest ? date : newest), dates[0]);
    return newestDate.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  }, [latestEnvironment, latestSensor]);
  const latestPpm = useMemo(() => getPpmValue(latestSensor), [latestSensor]);

  const fetchDashboard = useCallback(async (silent = false) => {
    if (!token) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      if (!silent) setLoading(true);

      const [fireResponse, sensorResponse, environmentResponse] = await Promise.all([
        apiFetch('/fire-alarm', { token }),
        apiFetch('/mq135statistics?NumOfRecords=1', { token }),
        apiFetch('/dht22statistics?NumOfRecords=1', { token }),
      ]);

      const fireData = await fireResponse.json();
      const sensorData = await sensorResponse.json();
      const environmentData = await environmentResponse.json();
      const newestRecord = Array.isArray(sensorData) ? sensorData[0] : null;
      const newestEnvironment = Array.isArray(environmentData) ? environmentData[0] : null;

      setIsFire(Boolean(fireData.isFire));
      setLatestSensor(newestRecord || null);
      setLatestEnvironment(newestEnvironment || null);

      if (fireData.isFire) {
        Alert.alert('Cảnh báo', 'Hệ thống phát hiện nguy cơ cháy.');
      }
    } catch (error) {
      if (isAuthError(error)) {
        await logout();
        return;
      }

      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [logout, token]);

  useEffect(() => {
    fetchDashboard();
    const intervalId = setInterval(() => fetchDashboard(true), 10000);
    return () => clearInterval(intervalId);
  }, [fetchDashboard]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard(true);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
    >
      <View style={styles.topBar}>
        <View>
          <Text style={styles.greeting}>Xin chào, {user?.username || 'bạn'}</Text>
          <Text style={styles.subtitle}>Bảng điều khiển nhà thông minh</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutButton} activeOpacity={0.85}>
          <MaterialCommunityIcons name="logout" size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <View style={[styles.heroCard, isFire && styles.heroAlert]}>
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons
            name={isFire ? 'fire-alert' : 'home-thermometer-outline'}
            size={34}
            color={isFire ? '#dc2626' : '#2563eb'}
          />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.heroLabel}>Trạng thái hệ thống</Text>
          <Text style={styles.heroTitle}>{isFire ? 'Cảnh báo nguy hiểm' : 'Môi trường ổn định'}</Text>
          <Text style={styles.heroText}>
            {isFire ? 'Kiểm tra khu vực cảm biến ngay lập tức.' : `Cập nhật lúc ${lastUpdated}`}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Đang tải dữ liệu cảm biến...</Text>
        </View>
      ) : (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Chỉ số môi trường</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Monitoring')} activeOpacity={0.8}>
              <Text style={styles.sectionAction}>Lịch sử</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sensorGrid}>
            <SensorCard
              icon="thermometer"
              label="Nhiệt độ"
              value={formatNumber(latestEnvironment?.temp, '°C')}
              accent="#ef4444"
            />
            <SensorCard
              icon="water-percent"
              label="Độ ẩm"
              value={formatNumber(latestEnvironment?.humidity, '%')}
              accent="#0ea5e9"
            />
            <SensorCard
              icon="air-filter"
              label="Không khí"
              value={qualityText(latestSensor?.airQuality)}
              accent={qualityColor(latestSensor?.airQuality)}
            />
          </View>

          <View style={styles.metricsCard}>
            <MetricRow label="PPM hiện tại" value={formatNumber(latestPpm, ' ppm')} color={ppmColor(latestPpm)} />
          </View>
        </>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Điều khiển nhanh</Text>
      </View>
      <View style={styles.actionGrid}>
        <ActionCard
          icon="lightbulb-on-outline"
          title="Thiết bị"
          description="Đèn và quạt demo"
          onPress={() => navigation.navigate('Devices', { room: 'Phòng demo' })}
        />
        <ActionCard
          icon="chart-line"
          title="Theo dõi"
          description="Biểu đồ cảm biến"
          onPress={() => navigation.navigate('Monitoring')}
        />
      </View>
    </ScrollView>
  );
};

const SensorCard = ({
  icon,
  label,
  value,
  accent,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string;
  accent: string;
}) => (
  <View style={styles.sensorCard}>
    <View style={[styles.sensorIcon, { backgroundColor: `${accent}18` }]}>
      <MaterialCommunityIcons name={icon} size={24} color={accent} />
    </View>
    <Text style={styles.sensorLabel}>{label}</Text>
    <Text style={styles.sensorValue} numberOfLines={1} adjustsFontSizeToFit>
      {value}
    </Text>
  </View>
);

const MetricRow = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <View style={styles.metricRow}>
    <View style={styles.metricLabelWrap}>
      <View style={[styles.metricDot, { backgroundColor: color }]} />
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
    <Text style={styles.metricValue}>{value}</Text>
  </View>
);

const ActionCard = ({
  icon,
  title,
  description,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
}) => (
  <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.86}>
    <View style={styles.actionIcon}>
      <MaterialCommunityIcons name={icon} size={28} color="#2563eb" />
    </View>
    <Text style={styles.actionTitle}>{title}</Text>
    <Text style={styles.actionDescription}>{description}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 18,
    paddingBottom: 28,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  greeting: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 3,
  },
  logoutButton: {
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderRadius: 18,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  heroCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#dbeafe',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 18,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  heroAlert: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  heroCopy: {
    flex: 1,
  },
  heroLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#0f172a',
    fontSize: 21,
    fontWeight: '800',
    marginTop: 3,
  },
  heroText: {
    color: '#475569',
    fontSize: 13,
    marginTop: 5,
  },
  loadingBox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginTop: 16,
    padding: 24,
  },
  loadingText: {
    color: '#64748b',
    marginTop: 10,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 22,
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
  },
  sectionAction: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '700',
  },
  sensorGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  sensorCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 132,
    padding: 12,
  },
  sensorIcon: {
    alignItems: 'center',
    borderRadius: 8,
    height: 40,
    justifyContent: 'center',
    marginBottom: 12,
    width: 40,
  },
  sensorLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  sensorValue: {
    color: '#0f172a',
    fontSize: 21,
    fontWeight: '900',
    marginTop: 6,
  },
  metricsCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    padding: 16,
  },
  metricRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  metricLabelWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  metricDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  metricLabel: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '700',
  },
  metricValue: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 128,
    padding: 14,
  },
  actionIcon: {
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    marginBottom: 14,
    width: 44,
  },
  actionTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  actionDescription: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
  },
});

export default HomePage;
