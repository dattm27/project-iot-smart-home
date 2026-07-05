import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { apiFetch } from './api';
import { useAuth } from './AuthContext';

type DeviceKind = 'light' | 'fan';

type DeviceItem = {
  id: string;
  name: string;
  displayName: string;
  room: string;
  kind: DeviceKind;
  state: boolean;
  timerEnabled?: boolean;
  autoOnTime?: string | null;
  autoOffTime?: string | null;
  isAutoControlled?: boolean;
  lightSensorEnabled?: boolean;
  lastAutoReason?: string | null;
  autoOnByTemperature?: boolean;
  autoOnTemperature?: number;
};

interface TimerData {
  timerEnabled: boolean;
  autoOnTime: Date;
  autoOffTime: Date;
}

type TimerInputKey = 'autoOnTime' | 'autoOffTime';

type TimerInputs = Record<TimerInputKey, string>;

type AutoCoolingData = {
  autoOnByTemperature: boolean;
  autoOnTemperature: string;
};

const formatTimeInput = (date: Date) => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const normalizeTimeInput = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
};

const dateWithTimeInput = (baseDate: Date, value: string) => {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;

  const nextDate = new Date(baseDate);
  nextDate.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return nextDate;
};

const formatDeviceTimerRange = (device: DeviceItem) => {
  if (!device.timerEnabled || !device.autoOnTime || !device.autoOffTime) return null;

  const autoOnTime = new Date(device.autoOnTime);
  const autoOffTime = new Date(device.autoOffTime);
  if (Number.isNaN(autoOnTime.getTime()) || Number.isNaN(autoOffTime.getTime())) return null;

  return `${formatTimeInput(autoOnTime)} - ${formatTimeInput(autoOffTime)}`;
};

const fallbackDevices: DeviceItem[] = [
  {
    id: 'light-DEN_PH',
    name: 'DEN_PH',
    displayName: 'Đèn phòng',
    room: 'Phòng demo',
    kind: 'light',
    state: false,
  },
  {
    id: 'fan-QUAT_1',
    name: 'QUAT_1',
    displayName: 'Quạt thông gió',
    room: 'Phòng demo',
    kind: 'fan',
    state: false,
    autoOnByTemperature: true,
    autoOnTemperature: 30,
  },
];

const sendDeviceCommand = async (
  deviceName: string,
  kind: DeviceKind,
  type: number,
  token: string | null,
) => {
  const endpoint = kind === 'fan' ? '/fans/OnOff' : '/lights/OnOff';
  await apiFetch(endpoint, {
    method: 'PUT',
    token,
    body: JSON.stringify({
      name: deviceName,
      type,
    }),
  });
};

const sendTimer = async (
  deviceName: string,
  kind: DeviceKind,
  timerData: TimerData,
  token: string | null,
) => {
  const endpoint = kind === 'fan' ? '/fans/Timer/' : '/lights/Timer/';
  const response = await apiFetch(endpoint, {
    method: 'PUT',
    token,
    body: JSON.stringify({
      name: deviceName,
      timerEnabled: timerData.timerEnabled,
      autoOnTime: timerData.autoOnTime.toISOString(),
      autoOffTime: timerData.autoOffTime.toISOString(),
    }),
  });

  return response.json();
};

const sendAutoCooling = async (
  deviceName: string,
  autoCoolingData: { autoOnByTemperature: boolean; autoOnTemperature: number },
  token: string | null,
) => {
  const response = await apiFetch('/fans/AutoCooling', {
    method: 'PUT',
    token,
    body: JSON.stringify({
      name: deviceName,
      autoOnByTemperature: autoCoolingData.autoOnByTemperature,
      autoOnTemperature: autoCoolingData.autoOnTemperature,
    }),
  });

  return response.json();
};

const sendLightSensorMode = async (deviceName: string, enabled: boolean, token: string | null) => {
  const response = await apiFetch('/lights/SensorMode', {
    method: 'PUT',
    token,
    body: JSON.stringify({
      name: deviceName,
      enabled,
    }),
  });

  return response.json();
};

const normalizeLight = (light: any): DeviceItem => ({
  id: `light-${light._id || light.name}`,
  name: light.name,
  displayName: 'Đèn phòng',
  room: light.room || 'Phòng demo',
  kind: 'light',
  state: Number(light.status) === 1,
  timerEnabled: light.timerEnabled,
  autoOnTime: light.autoOnTime,
  autoOffTime: light.autoOffTime,
  isAutoControlled: light.isAutoControlled,
  lightSensorEnabled: light.lightSensorEnabled,
});

const normalizeFan = (fan: any): DeviceItem => ({
  id: `fan-${fan._id || fan.name}`,
  name: fan.name,
  displayName: 'Quạt thông gió',
  room: fan.room || 'Phòng demo',
  kind: 'fan',
  state: Number(fan.status) === 1,
  timerEnabled: fan.timerEnabled,
  autoOnTime: fan.autoOnTime,
  autoOffTime: fan.autoOffTime,
  isAutoControlled: fan.isAutoControlled,
  lastAutoReason: fan.lastAutoReason,
  autoOnByTemperature: fan.autoOnByTemperature,
  autoOnTemperature: fan.autoOnTemperature,
});

const DevicesPage: React.FC = ({ route }: any) => {
  const requestedRoom = route?.params?.room || 'Phòng demo';
  const { token } = useAuth();
  const [devices, setDevices] = useState<DeviceItem[]>(fallbackDevices);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingDevice, setPendingDevice] = useState<string | null>(null);
  const [pendingSensorDevice, setPendingSensorDevice] = useState<string | null>(null);
  const [isSavingTimer, setIsSavingTimer] = useState(false);
  const [isSavingAutoCooling, setIsSavingAutoCooling] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceItem | null>(null);
  const [timerData, setTimerData] = useState<TimerData>({
    timerEnabled: false,
    autoOnTime: new Date(),
    autoOffTime: new Date(),
  });
  const [timerInputs, setTimerInputs] = useState<TimerInputs>({
    autoOnTime: formatTimeInput(new Date()),
    autoOffTime: formatTimeInput(new Date()),
  });
  const [autoCoolingData, setAutoCoolingData] = useState<AutoCoolingData>({
    autoOnByTemperature: true,
    autoOnTemperature: '30',
  });
  const [isTimerModalVisible, setIsTimerModalVisible] = useState(false);
  const [isAutoCoolingModalVisible, setIsAutoCoolingModalVisible] = useState(false);

  const activeCount = useMemo(() => devices.filter((device) => device.state).length, [devices]);

  const fetchDevices = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const [lightsResult, fansResult] = await Promise.allSettled([
        apiFetch('/lights/', { token }),
        apiFetch('/fans/', { token }),
      ]);

      const loadedDevices: DeviceItem[] = [];

      if (lightsResult.status === 'fulfilled') {
        const lightData = await lightsResult.value.json();
        if (Array.isArray(lightData.lights) && lightData.lights.length > 0) {
          loadedDevices.push(normalizeLight(lightData.lights[0]));
        }
      }

      if (fansResult.status === 'fulfilled') {
        const fanData = await fansResult.value.json();
        if (Array.isArray(fanData.fans) && fanData.fans.length > 0) {
          loadedDevices.push(normalizeFan(fanData.fans[0]));
        }
      }

      setDevices(loadedDevices.length > 0 ? loadedDevices : fallbackDevices);
    } catch (error) {
      console.error('Error fetching devices:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDevices();
    const intervalId = setInterval(() => fetchDevices(true), 30000);
    return () => clearInterval(intervalId);
  }, [fetchDevices]);

  const refreshLatestDevices = () => {
    setRefreshing(true);
    fetchDevices(true);
  };

  const toggleDevice = async (device: DeviceItem) => {
    const nextState = !device.state;
    const nextType = nextState ? 1 : 0;

    setPendingDevice(device.id);
    setDevices((prevDevices) =>
      prevDevices.map((item) => (item.id === device.id ? { ...item, state: nextState } : item)),
    );

    try {
      await sendDeviceCommand(device.name, device.kind, nextType, token);
    } catch (error) {
      setDevices((prevDevices) =>
        prevDevices.map((item) => (item.id === device.id ? { ...item, state: device.state } : item)),
      );
      Alert.alert('Lỗi', error instanceof Error ? error.message : 'Không thể cập nhật thiết bị.');
    } finally {
      setPendingDevice(null);
    }
  };

  const toggleLightSensorMode = async (device: DeviceItem) => {
    if (device.kind !== 'light') return;

    const nextEnabled = !(device.lightSensorEnabled ?? false);
    setPendingSensorDevice(device.id);
    setDevices((prevDevices) =>
      prevDevices.map((item) => (item.id === device.id ? { ...item, lightSensorEnabled: nextEnabled } : item)),
    );

    try {
      const response = await sendLightSensorMode(device.name, nextEnabled, token);
      setDevices((prevDevices) =>
        prevDevices.map((item) =>
          item.id === device.id
            ? { ...item, lightSensorEnabled: response.lightSensorEnabled ?? nextEnabled }
            : item,
        ),
      );
    } catch (error) {
      setDevices((prevDevices) =>
        prevDevices.map((item) =>
          item.id === device.id ? { ...item, lightSensorEnabled: device.lightSensorEnabled ?? false } : item,
        ),
      );
      Alert.alert('Lỗi', error instanceof Error ? error.message : 'Không thể cập nhật chế độ cảm biến ánh sáng.');
    } finally {
      setPendingSensorDevice(null);
    }
  };

  const handleOpenTimerModal = (device: DeviceItem) => {
    const autoOnTime = device.autoOnTime ? new Date(device.autoOnTime) : new Date();
    const autoOffTime = device.autoOffTime ? new Date(device.autoOffTime) : new Date();

    setSelectedDevice(device);
    setTimerData({
      timerEnabled: device.timerEnabled ?? false,
      autoOnTime,
      autoOffTime,
    });
    setTimerInputs({
      autoOnTime: formatTimeInput(autoOnTime),
      autoOffTime: formatTimeInput(autoOffTime),
    });
    setIsTimerModalVisible(true);
  };

  const handleOpenAutoCoolingModal = (device: DeviceItem) => {
    setSelectedDevice(device);
    setAutoCoolingData({
      autoOnByTemperature: device.autoOnByTemperature ?? true,
      autoOnTemperature: String(device.autoOnTemperature ?? 30),
    });
    setIsAutoCoolingModalVisible(true);
  };

  const handleTimerInputChange = (key: TimerInputKey, value: string) => {
    setTimerInputs((prev) => ({
      ...prev,
      [key]: normalizeTimeInput(value),
    }));
    setTimerData((prev) => ({ ...prev, timerEnabled: true }));
  };

  const handleSetTimer = async () => {
    if (!selectedDevice) return;

    const autoOnTime = dateWithTimeInput(timerData.autoOnTime, timerInputs.autoOnTime);
    const autoOffTime = dateWithTimeInput(timerData.autoOffTime, timerInputs.autoOffTime);

    if (timerData.timerEnabled && (!autoOnTime || !autoOffTime)) {
      Alert.alert('Lỗi', 'Vui lòng nhập giờ theo định dạng HH:mm, ví dụ 07:30.');
      return;
    }

    const nextTimerData = {
      ...timerData,
      timerEnabled: timerData.timerEnabled,
      autoOnTime: autoOnTime || timerData.autoOnTime,
      autoOffTime: autoOffTime || timerData.autoOffTime,
    };

    try {
      setIsSavingTimer(true);
      const timerResponse = await sendTimer(selectedDevice.name, selectedDevice.kind, nextTimerData, token);
      setTimerData(nextTimerData);
      setDevices((prevDevices) =>
        prevDevices.map((device) =>
          device.id === selectedDevice.id
            ? {
                ...device,
                timerEnabled: timerResponse.timerEnabled ?? nextTimerData.timerEnabled,
                autoOnTime: timerResponse.autoOnTime ?? nextTimerData.autoOnTime.toISOString(),
                autoOffTime: timerResponse.autoOffTime ?? nextTimerData.autoOffTime.toISOString(),
              }
            : device,
        ),
      );
      setIsTimerModalVisible(false);
      Alert.alert(
        'Thành công',
        nextTimerData.timerEnabled ? 'Đã lưu hẹn giờ cho thiết bị.' : 'Đã tắt hẹn giờ cho thiết bị.',
      );
      fetchDevices(true);
    } catch (error) {
      Alert.alert('Lỗi', error instanceof Error ? error.message : 'Không thể lưu hẹn giờ.');
    } finally {
      setIsSavingTimer(false);
    }
  };

  const handleSetAutoCooling = async () => {
    if (!selectedDevice || selectedDevice.kind !== 'fan') return;

    const threshold = Number(autoCoolingData.autoOnTemperature);
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
      Alert.alert('Lỗi', 'Ngưỡng nhiệt độ phải là số từ 0 đến 100°C.');
      return;
    }

    try {
      setIsSavingAutoCooling(true);
      await sendAutoCooling(
        selectedDevice.name,
        {
          autoOnByTemperature: autoCoolingData.autoOnByTemperature,
          autoOnTemperature: threshold,
        },
        token,
      );
      setDevices((prevDevices) =>
        prevDevices.map((device) =>
          device.id === selectedDevice.id
            ? {
                ...device,
                autoOnByTemperature: autoCoolingData.autoOnByTemperature,
                autoOnTemperature: threshold,
              }
            : device,
        ),
      );
      setIsAutoCoolingModalVisible(false);
      Alert.alert('Thành công', 'Đã lưu tự động bật quạt theo nhiệt độ.');
      fetchDevices(true);
    } catch (error) {
      Alert.alert('Lỗi', error instanceof Error ? error.message : 'Không thể lưu tự động theo nhiệt độ.');
    } finally {
      setIsSavingAutoCooling(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshLatestDevices} tintColor="#2563eb" />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Điều khiển thiết bị</Text>
          <Text style={styles.title}>{requestedRoom}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            accessibilityLabel="Làm mới thiết bị"
            activeOpacity={0.85}
            onPress={refreshLatestDevices}
            style={styles.refreshButton}
          >
            {refreshing ? (
              <ActivityIndicator color="#2563eb" size="small" />
            ) : (
              <MaterialCommunityIcons name="refresh" size={20} color="#2563eb" />
            )}
          </TouchableOpacity>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeValue}>{activeCount}/{devices.length}</Text>
            <Text style={styles.headerBadgeLabel}>Đang bật</Text>
          </View>
        </View>
      </View>

      <View style={styles.sceneCard}>
        <View style={styles.sceneIcon}>
          <MaterialCommunityIcons name="home-lightning-bolt-outline" size={32} color="#2563eb" />
        </View>
        <View style={styles.sceneCopy}>
          <Text style={styles.sceneTitle}>Demo phòng thông minh</Text>
          <Text style={styles.sceneText}>Một đèn chiếu sáng và một quạt thông gió kết nối trực tiếp backend.</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#2563eb" size="large" />
          <Text style={styles.loadingText}>Đang lấy trạng thái thiết bị...</Text>
        </View>
      ) : (
        <View style={styles.devicesWrap}>
          {devices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              isPending={pendingDevice === device.id}
              onToggle={() => toggleDevice(device)}
              onTimer={() => handleOpenTimerModal(device)}
              onAutoCooling={() => handleOpenAutoCoolingModal(device)}
              onLightSensorMode={() => toggleLightSensorMode(device)}
              isSensorPending={pendingSensorDevice === device.id}
            />
          ))}
        </View>
      )}

      <Modal visible={isTimerModalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Hẹn giờ</Text>
                <Text style={styles.modalTitle}>{selectedDevice?.displayName}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsTimerModalVisible(false)} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={20} color="#475569" />
              </TouchableOpacity>
            </View>

            <View style={styles.timerPanel}>
              <TimerTimeInput
                label="Bật lúc"
                value={timerInputs.autoOnTime}
                onChangeText={(value) => handleTimerInputChange('autoOnTime', value)}
              />
              <TimerTimeInput
                label="Tắt lúc"
                value={timerInputs.autoOffTime}
                onChangeText={(value) => handleTimerInputChange('autoOffTime', value)}
              />
            </View>

            <View style={styles.timerSwitchRow}>
              <View>
                <Text style={styles.timerSwitchTitle}>Kích hoạt hẹn giờ</Text>
                <Text style={styles.timerSwitchText}>Tự động bật/tắt theo khung giờ đã chọn</Text>
              </View>
              <Switch
                value={timerData.timerEnabled}
                onValueChange={(value) => setTimerData((prev) => ({ ...prev, timerEnabled: value }))}
                thumbColor={timerData.timerEnabled ? '#ffffff' : '#f8fafc'}
                trackColor={{ false: '#cbd5e1', true: '#93c5fd' }}
              />
            </View>

            <TouchableOpacity
              disabled={isSavingTimer}
              style={[styles.primaryButton, isSavingTimer && styles.primaryButtonDisabled]}
              onPress={handleSetTimer}
              activeOpacity={0.85}
            >
              {isSavingTimer ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>Lưu hẹn giờ</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={isAutoCoolingModalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Tự động nhiệt độ</Text>
                <Text style={styles.modalTitle}>{selectedDevice?.displayName}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsAutoCoolingModalVisible(false)} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={20} color="#475569" />
              </TouchableOpacity>
            </View>

            <View style={styles.temperaturePanel}>
              <View style={styles.temperatureIcon}>
                <MaterialCommunityIcons name="thermometer" size={26} color="#ef4444" />
              </View>
              <View style={styles.temperatureCopy}>
                <Text style={styles.temperatureTitle}>Ngưỡng bật quạt</Text>
                <Text style={styles.temperatureText}>Quạt tự bật khi nhiệt độ đạt ngưỡng và PPM chưa vượt mức nguy hiểm.</Text>
              </View>
            </View>

            <View style={styles.timerSwitchRow}>
              <View>
                <Text style={styles.timerSwitchTitle}>Kích hoạt theo nhiệt độ</Text>
                <Text style={styles.timerSwitchText}>Tự động bật quạt khi cảm biến báo nóng</Text>
              </View>
              <Switch
                value={autoCoolingData.autoOnByTemperature}
                onValueChange={(value) => setAutoCoolingData((prev) => ({ ...prev, autoOnByTemperature: value }))}
                thumbColor={autoCoolingData.autoOnByTemperature ? '#ffffff' : '#f8fafc'}
                trackColor={{ false: '#cbd5e1', true: '#93c5fd' }}
              />
            </View>

            <View style={styles.thresholdInputWrap}>
              <Text style={styles.timerTimeLabel}>Ngưỡng nhiệt độ</Text>
              <View style={styles.thresholdInputRow}>
                <TextInput
                  keyboardType="decimal-pad"
                  maxLength={5}
                  onChangeText={(value) =>
                    setAutoCoolingData((prev) => ({
                      ...prev,
                      autoOnTemperature: value.replace(/[^0-9.]/g, ''),
                    }))
                  }
                  placeholder="30"
                  placeholderTextColor="#94a3b8"
                  selectTextOnFocus
                  style={styles.thresholdInput}
                  value={autoCoolingData.autoOnTemperature}
                />
                <Text style={styles.thresholdUnit}>°C</Text>
              </View>
            </View>

            <TouchableOpacity
              disabled={isSavingAutoCooling}
              style={[styles.primaryButton, isSavingAutoCooling && styles.primaryButtonDisabled]}
              onPress={handleSetAutoCooling}
              activeOpacity={0.85}
            >
              {isSavingAutoCooling ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>Lưu tự động nhiệt độ</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
};

const DeviceCard = ({
  device,
  isPending,
  onToggle,
  onTimer,
  onAutoCooling,
  onLightSensorMode,
  isSensorPending,
}: {
  device: DeviceItem;
  isPending: boolean;
  isSensorPending: boolean;
  onToggle: () => void;
  onTimer: () => void;
  onAutoCooling: () => void;
  onLightSensorMode: () => void;
}) => {
  const isLight = device.kind === 'light';
  const accent = isLight ? '#f59e0b' : '#0ea5e9';
  const icon = isLight ? 'lightbulb-on-outline' : 'fan';
  const statusText = device.state ? 'Đang bật' : 'Đang tắt';
  const timerRange = formatDeviceTimerRange(device);
  const detailText = device.isAutoControlled
    ? device.lastAutoReason === 'air_quality'
      ? 'Tự động do không khí'
      : 'Tự động theo cảm biến'
    : 'Điều khiển thủ công';

  return (
    <View style={[styles.deviceCard, device.state && { borderColor: accent }]}>
      <View style={styles.deviceTop}>
        <View style={[styles.deviceIcon, { backgroundColor: `${accent}18` }]}>
          <MaterialCommunityIcons name={icon} size={30} color={accent} />
        </View>
        {isPending ? (
          <ActivityIndicator color={accent} />
        ) : (
          <Switch
            value={device.state}
            onValueChange={onToggle}
            thumbColor={device.state ? '#ffffff' : '#f8fafc'}
            trackColor={{ false: '#cbd5e1', true: `${accent}88` }}
          />
        )}
      </View>

      <Text style={styles.deviceName}>{device.displayName}</Text>
      <Text style={styles.deviceCode}>{device.name}</Text>

      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: device.state ? accent : '#94a3b8' }]} />
        <Text style={styles.statusText}>{statusText}</Text>
      </View>
      <Text style={styles.detailText}>{detailText}</Text>

      {device.kind === 'fan' ? (
        <View style={styles.autoInfoBox}>
          <MaterialCommunityIcons
            name={device.autoOnByTemperature ? 'thermometer-auto' : 'thermometer-off'}
            size={17}
            color={device.autoOnByTemperature ? '#ef4444' : '#94a3b8'}
          />
          <Text style={styles.autoInfoText}>
            {device.autoOnByTemperature
              ? `Tự động từ ${device.autoOnTemperature ?? 30}°C`
              : 'Chưa bật tự động theo nhiệt độ'}
          </Text>
        </View>
      ) : null}

      {device.kind === 'light' ? (
        <View style={styles.sensorModeRow}>
          <View style={styles.sensorModeCopy}>
            <View style={styles.sensorModeTitleRow}>
              <MaterialCommunityIcons
                name={device.lightSensorEnabled ? 'brightness-auto' : 'brightness-5'}
                size={17}
                color={device.lightSensorEnabled ? '#f59e0b' : '#64748b'}
              />
              <Text style={styles.sensorModeTitle}>Cảm biến ánh sáng</Text>
            </View>
            <Text style={styles.sensorModeText}>
              {device.lightSensorEnabled ? 'Đang tự động theo ánh sáng' : 'Đang điều khiển thủ công'}
            </Text>
          </View>
          {isSensorPending ? (
            <ActivityIndicator color="#f59e0b" />
          ) : (
            <Switch
              value={device.lightSensorEnabled ?? false}
              onValueChange={onLightSensorMode}
              thumbColor={device.lightSensorEnabled ? '#ffffff' : '#f8fafc'}
              trackColor={{ false: '#cbd5e1', true: '#fbbf2488' }}
            />
          )}
        </View>
      ) : null}

      <TouchableOpacity style={styles.timerButton} onPress={onTimer} activeOpacity={0.85}>
        <MaterialCommunityIcons name="clock-outline" size={17} color="#2563eb" />
        <Text style={styles.timerButtonText}>{device.timerEnabled ? 'Đã bật hẹn giờ' : 'Đã tắt hẹn giờ'}</Text>
      </TouchableOpacity>
      {timerRange ? (
        <View style={styles.timerRangeBox}>
          <MaterialCommunityIcons name="calendar-clock" size={16} color="#475569" />
          <Text style={styles.timerRangeText}>Hẹn giờ: {timerRange}</Text>
        </View>
      ) : null}

      {device.kind === 'fan' ? (
        <TouchableOpacity style={styles.autoButton} onPress={onAutoCooling} activeOpacity={0.85}>
          <MaterialCommunityIcons name="thermometer-lines" size={17} color="#ef4444" />
          <Text style={styles.autoButtonText}>Cài tự động nhiệt độ</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const TimerTimeInput = ({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) => (
  <View style={styles.timerTimeButton}>
    <Text style={styles.timerTimeLabel}>{label}</Text>
    <TextInput
      keyboardType="number-pad"
      maxLength={5}
      onChangeText={onChangeText}
      placeholder="HH:mm"
      placeholderTextColor="#94a3b8"
      selectTextOnFocus
      style={styles.timerTimeInput}
      value={value}
    />
  </View>
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
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  refreshButton: {
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderColor: '#dbeafe',
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerBadge: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#dbeafe',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerBadgeValue: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  headerBadgeLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  sceneCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },
  sceneIcon: {
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  sceneCopy: {
    flex: 1,
  },
  sceneTitle: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '800',
  },
  sceneText: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  loadingBox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginTop: 18,
    padding: 24,
  },
  loadingText: {
    color: '#64748b',
    marginTop: 10,
  },
  devicesWrap: {
    gap: 14,
    marginTop: 18,
  },
  deviceCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  deviceTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  deviceIcon: {
    alignItems: 'center',
    borderRadius: 8,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  deviceName: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 16,
  },
  deviceCode: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  statusDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  statusText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
  },
  detailText: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 5,
  },
  autoInfoBox: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 7,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  autoInfoText: {
    color: '#991b1b',
    fontSize: 12,
    fontWeight: '800',
  },
  sensorModeRow: {
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sensorModeCopy: {
    flex: 1,
    paddingRight: 12,
  },
  sensorModeTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  sensorModeTitle: {
    color: '#92400e',
    fontSize: 13,
    fontWeight: '900',
  },
  sensorModeText: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  timerButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 7,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  timerButtonText: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '800',
  },
  timerRangeBox: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  timerRangeText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '800',
  },
  autoButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#fff1f2',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 7,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  autoButtonText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '800',
  },
  modalContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.46)',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 18,
    width: '100%',
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
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
  timerPanel: {
    flexDirection: 'row',
    gap: 10,
  },
  timerTimeButton: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 14,
  },
  timerTimeLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
  },
  timerTimeInput: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 5,
    padding: 0,
  },
  timerSwitchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  timerSwitchTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
  timerSwitchText: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 3,
    maxWidth: 220,
  },
  temperaturePanel: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  temperatureIcon: {
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  temperatureCopy: {
    flex: 1,
  },
  temperatureTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
  },
  temperatureText: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  thresholdInputWrap: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
    padding: 14,
  },
  thresholdInputRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  thresholdInput: {
    color: '#0f172a',
    flex: 1,
    fontSize: 28,
    fontWeight: '900',
    padding: 0,
  },
  thresholdUnit: {
    color: '#64748b',
    fontSize: 18,
    fontWeight: '900',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 8,
    marginTop: 18,
    paddingVertical: 13,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
});

export default DevicesPage;
