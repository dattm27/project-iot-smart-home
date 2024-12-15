import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Modal, Button } from 'react-native';
import { LineChart } from 'react-native-chart-kit'; // For Line chart visualization
import { Dimensions } from 'react-native';

// Get screen width for chart responsiveness
const screenWidth = Dimensions.get('window').width;

const MonitoringPage: React.FC = () => {
  const [data, setData] = useState<any[]>([]); // Store the fetched data
  const [loading, setLoading] = useState<boolean>(true); // Handle loading state
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'time',
    direction: 'asc',
  }); // Sorting state
  const [numOfRecords, setNumOfRecords] = useState<number>(10); // Specify number of records to fetch
  const [modalVisible, setModalVisible] = useState<boolean>(false); // Modal visibility for line chart
  const [chartData, setChartData] = useState<any>(null); // Data for line chart
  const SERVER_URL = 'http://192.168.1.4:4000'; // Your server's IP address

  // Fetch the data from the server with the specified number of records
  const fetchData = async () => {
    try {
      const response = await fetch(`${SERVER_URL}/mq135statistics?NumOfRecords=${numOfRecords}`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Fetched data:', data);
      setData(data); // Set the fetched data
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false); // Stop loading after fetching the data
    }
  };

  // Handle sorting logic
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });

    const sortedData = [...data].sort((a, b) => {
      if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
      if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    setData(sortedData); // Update the sorted data
  };

  // Format the time data to be more readable
  const formatTime = (time: string) => {
    const date = new Date(time);
    return date.toLocaleString();
  };

  // Fetch data when the component mounts or when `numOfRecords` changes
  useEffect(() => {
    fetchData();
  }, [numOfRecords]);

  // Open modal with chart data for CO and CO2
  const openChartModal = () => {
    const coData = data.map(item => item.co_ppm);
    const co2Data = data.map(item => item.co2_ppm);
    const timeLabels = data.map(item => formatTime(item.time));

    setChartData({
      labels: timeLabels,
      datasets: [
        {
          data: coData,
          color: (opacity = 1) => `rgba(255, 0, 0, ${opacity})`, // Red color for CO
          strokeWidth: 2,
        },
        {
          data: co2Data,
          color: (opacity = 1) => `rgba(0, 0, 255, ${opacity})`, // Blue color for CO2
          strokeWidth: 2,
        },
      ],
    });

    setModalVisible(true);
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" /> // Show loading indicator while fetching data
      ) : (
        <>
          {/* Sort Buttons */}
          <View style={styles.sortContainer}>
            <TouchableOpacity onPress={() => handleSort('time')} style={styles.sortButton}>
              <Text style={styles.buttonText}>Sort by Time</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleSort('co2_ppm')} style={styles.sortButton}>
              <Text style={styles.buttonText}>Sort by CO2 (ppm)</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleSort('co_ppm')} style={styles.sortButton}>
              <Text style={styles.buttonText}>Sort by CO (ppm)</Text>
            </TouchableOpacity>
          </View>

          {/* Table Header */}
          <ScrollView style={styles.tableContainer}>
            <View style={styles.row}>
              <TouchableOpacity onPress={() => handleSort('airQuality')} style={[styles.cell, styles.headerCell]}>
                <Text style={styles.headerText}>Air Quality</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleSort('co2_ppm')} style={[styles.cell, styles.headerCell]}>
                <Text style={styles.headerText}>CO2 (ppm)</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleSort('co_ppm')} style={[styles.cell, styles.headerCell]}>
                <Text style={styles.headerText}>CO (ppm)</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleSort('time')} style={[styles.cell, styles.headerCell]}>
                <Text style={styles.headerText}>Time</Text>
              </TouchableOpacity>
            </View>

            {/* Table Rows */}
            {data.map((item) => (
              <View key={item._id} style={styles.row}>
                <View style={styles.cell}>
                  <Text style={styles.cellText}>{item.airQuality}</Text>
                </View>
                <View style={styles.cell}>
                  <Text style={styles.cellText}>{item.co2_ppm.toFixed(2)}</Text>
                </View>
                <View style={styles.cell}>
                  <Text style={styles.cellText}>{item.co_ppm.toFixed(2)}</Text>
                </View>
                <View style={styles.cell}>
                  <Text style={styles.cellText}>{formatTime(item.time)}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Button to Show Line Chart */}
          <TouchableOpacity onPress={openChartModal} style={styles.chartButton}>
            <Text style={styles.buttonText}>Show CO & CO2 Levels Chart</Text>
          </TouchableOpacity>

          {/* Modal for Line Chart */}
          <Modal visible={modalVisible} transparent={true} animationType="slide">
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <LineChart
                  data={chartData}
                  width={screenWidth - 40} // Width of the chart
                  height={220}
                  chartConfig={{
                    backgroundColor: '#ffffff',
                    backgroundGradientFrom: '#f5f5f5',
                    backgroundGradientTo: '#f5f5f5',
                    decimalPlaces: 2, // Optional, specify decimal places
                    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    style: {
                      borderRadius: 16,
                    },
                  }}
                />
                <Button title="Close" onPress={() => setModalVisible(false)} />
              </View>
            </View>
          </Modal>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: '#f4f4f4',
  },
  tableContainer: {
    marginTop: 10,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 10,
  },
  cell: {
    flex: 1, // Makes the cell take up equal space
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  headerCell: {
    backgroundColor: '#4CAF50', // Green background for the header
  },
  headerText: {
    color: '#fff', // White text for header
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
    paddingVertical: 10,
  },
  cellText: {
    fontSize: 14,
    textAlign: 'center',
  },
  sortContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
    marginTop: 10,
  },
  sortButton: {
    padding: 10,
    backgroundColor: '#4CAF50',
    borderRadius: 5,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  chartButton: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#4CAF50',
    borderRadius: 5,
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    width: screenWidth - 40,
    alignItems: 'center',
  },
});

export default MonitoringPage;
