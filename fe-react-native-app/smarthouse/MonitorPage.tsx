import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { apiFetch } from './api';
import { useAuth } from './AuthContext';

const screenWidth = Dimensions.get('window').width;

type SensorRecord = {
  _id?: string;
  time: string;
  timestamp?: string;
  airQuality: string;
  ppm?: number;
  co2_ppm?: number;
  co_ppm?: number;
};

type EnvironmentRecord = {
  _id?: string;
  time: string;
  timestamp?: string;
  temp: number;
  humidity?: number;
};

const recordOptions = [10, 20, 50];

const formatTime = (time?: string) => {
  if (!time) return '--';
  return new Date(time).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
};

const formatNumber = (value?: number, digits = 1) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--';
  return value.toFixed(digits);
};

const getPpmValue = (record?: SensorRecord | null) => {
  if (!record) return undefined;
  if (typeof record.ppm === 'number') return record.ppm;

  const legacyValues = [record.co2_ppm, record.co_ppm].filter(
    (value): value is number => typeof value === 'number' && !Number.isNaN(value),
  );
  return legacyValues.length > 0 ? Math.max(...legacyValues) : undefined;
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

const MonitoringPage: React.FC = () => {
  const [data, setData] = useState<SensorRecord[]>([]);
  const [environmentData, setEnvironmentData] = useState<EnvironmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof SensorRecord; direction: 'asc' | 'desc' }>({
    key: 'time',
    direction: 'desc',
  });
  const [numOfRecords, setNumOfRecords] = useState(10);
  const [modalVisible, setModalVisible] = useState(false);
  const { token } = useAuth();

  const latest = data[0];

  const averages = useMemo(() => {
    if (data.length === 0 && environmentData.length === 0) {
      return { temp: undefined, humidity: undefined, ppm: undefined };
    }

    const ppmTotals = data.reduce((sum, item) => sum + Number(getPpmValue(item) || 0), 0);
    const tempTotals = environmentData.reduce(
      (acc, item) => ({
        temp: acc.temp + Number(item.temp || 0),
        humidity: acc.humidity + Number(item.humidity || 0),
      }),
      { temp: 0, humidity: 0 },
    );

    return {
      temp: environmentData.length > 0 ? tempTotals.temp / environmentData.length : undefined,
      humidity: environmentData.length > 0 ? tempTotals.humidity / environmentData.length : undefined,
      ppm: data.length > 0 ? ppmTotals / data.length : undefined,
    };
  }, [data, environmentData]);

  const chartData = useMemo(() => {
    const chartRecords = [...data].reverse().slice(-8);
    if (chartRecords.length === 0) return null;

    return {
      labels: chartRecords.map((item) =>
        new Date(item.timestamp || item.time).toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      ),
      datasets: [
        {
          data: chartRecords.map((item) => Number(getPpmValue(item) || 0)),
          color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
          strokeWidth: 2,
        },
      ],
      legend: ['PPM'],
    };
  }, [data]);

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [response, environmentResponse] = await Promise.all([
        apiFetch(`/mq135statistics?NumOfRecords=${numOfRecords}`, { token }),
        apiFetch(`/dht22statistics?NumOfRecords=${numOfRecords}`, { token }),
      ]);
      const sensorData = await response.json();
      const dht22Data = await environmentResponse.json();
      setData(Array.isArray(sensorData) ? sensorData : []);
      setEnvironmentData(Array.isArray(dht22Data) ? dht22Data : []);
    } catch (error) {
      console.error('Error fetching sensor data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSort = (key: keyof SensorRecord) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction });

    const sortedData = [...data].sort((a, b) => {
      const valueA = key === 'ppm' ? getPpmValue(a) : a[key];
      const valueB = key === 'ppm' ? getPpmValue(b) : b[key];

      if (valueA === undefined || valueA === null) return 1;
      if (valueB === undefined || valueB === null) return -1;
      if (valueA < valueB) return direction === 'asc' ? -1 : 1;
      if (valueA > valueB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    setData(sortedData);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(true);
  };

  useEffect(() => {
    fetchData();
  }, [numOfRecords, token]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Giám sát môi trường</Text>
          <Text style={styles.title}>Phân tích cảm biến</Text>
        </View>
        <TouchableOpacity style={styles.chartIconButton} onPress={() => setModalVisible(true)} activeOpacity={0.85}>
          <MaterialCommunityIcons name="chart-line" size={22} color="#2563eb" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Đang tải dữ liệu mới nhất...</Text>
        </View>
      ) : (
        <>
          <View style={styles.heroCard}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name="air-filter" size={34} color={qualityColor(latest?.airQuality)} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroLabel}>Chất lượng hiện tại</Text>
              <Text style={[styles.heroTitle, { color: qualityColor(latest?.airQuality) }]}>
                {qualityText(latest?.airQuality)}
              </Text>
              <Text style={styles.heroText}>Mẫu mới nhất: {formatTime(latest?.timestamp || latest?.time)}</Text>
            </View>
          </View>

          <View style={styles.summaryGrid}>
            <SummaryCard icon="thermometer" label="Nhiệt độ TB" value={`${formatNumber(averages.temp)}°C`} color="#ef4444" />
            <SummaryCard icon="water-percent" label="Độ ẩm TB" value={`${formatNumber(averages.humidity)}%`} color="#0ea5e9" />
            <SummaryCard icon="smoke-detector-outline" label="PPM TB" value={`${formatNumber(averages.ppm)} ppm`} color="#ef4444" />
            <SummaryCard icon="alert-outline" label="Theo dõi từ" value="900 ppm" color="#f59e0b" />
          </View>

          <View style={styles.controlsRow}>
            {recordOptions.map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.recordButton, numOfRecords === option && styles.recordButtonActive]}
                onPress={() => setNumOfRecords(option)}
                activeOpacity={0.85}
              >
                <Text style={[styles.recordButtonText, numOfRecords === option && styles.recordButtonTextActive]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.chartCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Xu hướng khí gas</Text>
              <TouchableOpacity onPress={() => setModalVisible(true)} activeOpacity={0.85}>
                <Text style={styles.sectionAction}>Phóng to</Text>
              </TouchableOpacity>
            </View>
            {chartData ? (
              <LineChart
                data={chartData}
                width={screenWidth - 58}
                height={220}
                bezier
                withShadow={false}
                chartConfig={chartConfig}
                style={styles.chart}
              />
            ) : (
              <Text style={styles.emptyText}>Chưa có dữ liệu biểu đồ.</Text>
            )}
          </View>

          <View style={styles.tableCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Lịch sử đo</Text>
              <Text style={styles.tableHint}>Chạm cột để sắp xếp</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={styles.tableHeaderRow}>
                  <TableHeader title="Thời gian" width={128} onPress={() => handleSort('time')} />
                  <TableHeader title="Không khí" width={96} onPress={() => handleSort('airQuality')} />
                  <TableHeader title="PPM" width={92} onPress={() => handleSort('ppm')} />
                </View>
                {data.map((item, index) => (
                  <View key={item._id || `${item.time}-${index}`} style={styles.tableRow}>
                    <TableCell width={128} value={formatTime(item.timestamp || item.time)} muted />
                    <View style={[styles.tableCell, { width: 96 }]}>
                      <View style={[styles.qualityPill, { backgroundColor: `${qualityColor(item.airQuality)}18` }]}>
                        <Text style={[styles.qualityPillText, { color: qualityColor(item.airQuality) }]}>
                          {qualityText(item.airQuality)}
                        </Text>
                      </View>
                    </View>
                    <TableCell width={92} value={formatNumber(getPpmValue(item))} />
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </>
      )}

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Biểu đồ</Text>
                <Text style={styles.modalTitle}>PPM tổng</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={20} color="#475569" />
              </TouchableOpacity>
            </View>
            {chartData ? (
              <LineChart
                data={chartData}
                width={screenWidth - 54}
                height={260}
                bezier
                withShadow={false}
                chartConfig={chartConfig}
                style={styles.chart}
              />
            ) : (
              <Text style={styles.emptyText}>Chưa có dữ liệu biểu đồ.</Text>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const chartConfig = {
  backgroundColor: '#ffffff',
  backgroundGradientFrom: '#ffffff',
  backgroundGradientTo: '#ffffff',
  decimalPlaces: 1,
  color: (opacity = 1) => `rgba(15, 23, 42, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
  propsForDots: {
    r: '4',
    strokeWidth: '2',
    stroke: '#ffffff',
  },
  propsForBackgroundLines: {
    stroke: '#e2e8f0',
  },
};

const SummaryCard = ({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string;
  color: string;
}) => (
  <View style={styles.summaryCard}>
    <View style={[styles.summaryIcon, { backgroundColor: `${color}18` }]}>
      <MaterialCommunityIcons name={icon} size={22} color={color} />
    </View>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>
      {value}
    </Text>
  </View>
);

const TableHeader = ({ title, width, onPress }: { title: string; width: number; onPress: () => void }) => (
  <TouchableOpacity style={[styles.tableHeaderCell, { width }]} onPress={onPress} activeOpacity={0.8}>
    <Text style={styles.tableHeaderText}>{title}</Text>
  </TouchableOpacity>
);

const TableCell = ({ value, width, muted }: { value: string; width: number; muted?: boolean }) => (
  <View style={[styles.tableCell, { width }]}>
    <Text style={[styles.tableCellText, muted && styles.tableCellMuted]} numberOfLines={2}>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 18,
    paddingBottom: 30,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  eyebrow: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  title: {
    color: '#0f172a',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 2,
  },
  chartIconButton: {
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  loadingBox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 28,
  },
  loadingText: {
    color: '#64748b',
    marginTop: 10,
  },
  heroCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
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
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 25,
    fontWeight: '900',
    marginTop: 2,
  },
  heroText: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 5,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 124,
    padding: 12,
  },
  summaryIcon: {
    alignItems: 'center',
    borderRadius: 8,
    height: 38,
    justifyContent: 'center',
    marginBottom: 10,
    width: 38,
  },
  summaryLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
  },
  summaryValue: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 6,
  },
  controlsRow: {
    alignSelf: 'flex-start',
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 4,
    marginTop: 16,
    padding: 4,
  },
  recordButton: {
    borderRadius: 7,
    minWidth: 48,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  recordButtonActive: {
    backgroundColor: '#ffffff',
  },
  recordButtonText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  recordButtonTextActive: {
    color: '#2563eb',
  },
  chartCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
    overflow: 'hidden',
    padding: 14,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '900',
  },
  sectionAction: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '800',
  },
  chart: {
    borderRadius: 8,
    marginLeft: -8,
  },
  emptyText: {
    color: '#64748b',
    paddingVertical: 20,
    textAlign: 'center',
  },
  tableCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
    padding: 14,
  },
  tableHint: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  tableHeaderRow: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  tableHeaderCell: {
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  tableHeaderText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  tableRow: {
    alignItems: 'center',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 58,
  },
  tableCell: {
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  tableCellText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  tableCellMuted: {
    color: '#64748b',
    fontSize: 12,
  },
  qualityPill: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  qualityPillText: {
    fontSize: 12,
    fontWeight: '900',
  },
  modalContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.46)',
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    overflow: 'hidden',
    padding: 14,
    width: '100%',
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalEyebrow: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  modalTitle: {
    color: '#0f172a',
    fontSize: 21,
    fontWeight: '900',
    marginTop: 2,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
});

export default MonitoringPage;
