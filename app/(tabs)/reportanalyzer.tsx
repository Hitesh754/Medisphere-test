import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  Lock,
  FileText,
  Calendar,
  ChevronRight,
  Shield,
} from 'lucide-react-native';
import { mockDocuments } from '@/constants/mockData';
import { useState } from 'react';

export default function MediLensScreen() {
  const [selectedFilter, setSelectedFilter] = useState('All');
  const filters = ['All', 'Lab Report', 'Prescription', 'Vaccination'];

  const filteredDocuments =
    selectedFilter === 'All'
      ? mockDocuments
      : mockDocuments.filter((doc) => doc.type === selectedFilter);

  const getDocumentColor = (type: string) => {
    switch (type) {
      case 'Lab Report':
        return { bg: '#EFF6FF', icon: '#2563EB' };
      case 'Prescription':
        return { bg: '#F0FDF4', icon: '#10B981' };
      case 'Vaccination':
        return { bg: '#FEF3C7', icon: '#F59E0B' };
      default:
        return { bg: '#F1F5F9', icon: '#64748B' };
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>MediLens</Text>
          <View style={styles.securityBadge}>
            <Shield size={14} color="#10B981" />
            <Text style={styles.securityText}>End-to-end encrypted</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.lockButton}>
          <Lock size={24} color="#10B981" />
        </TouchableOpacity>
      </View>

      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}>
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterButton,
                selectedFilter === filter && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedFilter(filter)}>
              <Text
                style={[
                  styles.filterText,
                  selectedFilter === filter && styles.filterTextActive,
                ]}>
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.stats}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{mockDocuments.length}</Text>
            <Text style={styles.statLabel}>Total Documents</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {mockDocuments.filter((d) => d.type === 'Lab Report').length}
            </Text>
            <Text style={styles.statLabel}>Lab Reports</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {mockDocuments.filter((d) => d.type === 'Prescription').length}
            </Text>
            <Text style={styles.statLabel}>Prescriptions</Text>
          </View>
        </View>

        <View style={styles.documentsHeader}>
          <Text style={styles.sectionTitle}>
            {selectedFilter === 'All' ? 'All Documents' : selectedFilter + 's'}
          </Text>
          <TouchableOpacity style={styles.sortButton}>
            <Calendar size={16} color="#64748B" />
            <Text style={styles.sortText}>Sort by date</Text>
          </TouchableOpacity>
        </View>

        {filteredDocuments.map((document) => {
          const colors = getDocumentColor(document.type);
          return (
            <TouchableOpacity key={document.id} style={styles.documentCard}>
              <View style={[styles.documentIcon, { backgroundColor: colors.bg }]}>
                <FileText size={24} color={colors.icon} />
              </View>
              <View style={styles.documentInfo}>
                <Text style={styles.documentTitle}>{document.title}</Text>
                <View style={styles.documentMeta}>
                  <View style={styles.typeTag}>
                    <Text style={styles.typeText}>{document.type}</Text>
                  </View>
                  <Text style={styles.metaText}>•</Text>
                  <Text style={styles.metaText}>{document.fileSize}</Text>
                </View>
                <Text style={styles.documentDate}>
                  {new Date(document.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </View>
              <ChevronRight size={20} color="#CBD5E1" />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  securityText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  lockButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  filterScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  filterButtonActive: {
    backgroundColor: '#2563EB',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  stats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2563EB',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  documentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  sortText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  documentIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  documentInfo: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 6,
  },
  documentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  typeTag: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  metaText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  documentDate: {
    fontSize: 13,
    color: '#64748B',
  },
});