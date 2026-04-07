import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Modal,
  Image,
  Share,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  Lock,
  FileText,
  Calendar,
  ChevronRight,
  Shield,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { auth } from '@/utils/firebase';
import { deleteUserFileRecord, listUserFiles, type UploadedFile } from '@/utils/firebaseData';
import { Redirect, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { WebView } from 'react-native-webview';

export default function MediLockerScreen() {
  const router = useRouter();
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [documents, setDocuments] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewDocument, setPreviewDocument] = useState<UploadedFile | null>(null);
  const filters = ['All', 'Lab Report', 'Prescription', 'Vaccination', 'X-Ray', 'Document'];

  const loadFiles = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const files = await listUserFiles(user.uid);
      setDocuments(files);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  useFocusEffect(
    useCallback(() => {
      loadFiles();
    }, [loadFiles])
  );

  const filteredDocuments = useMemo(
    () =>
      selectedFilter === 'All'
        ? documents
        : documents.filter((doc) => doc.type === selectedFilter),
    [documents, selectedFilter]
  );

  if (!auth.currentUser) {
    return <Redirect href="/(auth)/login" />;
  }

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

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

  const openDocument = async (downloadURL?: string) => {
    if (!downloadURL) {
      return;
    }

    const document = documents.find((item) => item.downloadURL === downloadURL);
    const mimeType = document?.mimeType || '';

    if (mimeType.startsWith('image/') || mimeType === 'application/pdf') {
      setPreviewDocument(document || null);
      return;
    }

    const canOpen = await Linking.canOpenURL(downloadURL);
    if (!canOpen) {
      return;
    }

    await Linking.openURL(downloadURL);
  };

  const getAttachmentUrl = (downloadURL: string) => {
    return downloadURL.includes('/upload/')
      ? downloadURL.replace('/upload/', '/upload/fl_attachment/')
      : downloadURL;
  };

  const downloadDocument = async () => {
    if (!previewDocument?.downloadURL) {
      return;
    }

    await Linking.openURL(getAttachmentUrl(previewDocument.downloadURL));
  };

  const shareDocument = async () => {
    if (!previewDocument?.downloadURL) {
      return;
    }

    await Share.share({
      title: previewDocument.title,
      message: `${previewDocument.title}\n${previewDocument.downloadURL}`,
      url: previewDocument.downloadURL,
    });
  };

  const deleteDocument = async () => {
    if (!previewDocument || !auth.currentUser) {
      return;
    }

    Alert.alert('Delete File', 'Are you sure you want to delete this file from MediLocker?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteUserFileRecord(auth.currentUser!.uid, previewDocument.id);
            setDocuments((previous) => previous.filter((item) => item.id !== previewDocument.id));
            setPreviewDocument(null);
            Alert.alert('Deleted', 'File removed from your locker.');
          } catch (error: any) {
            Alert.alert('Delete failed', error?.message || 'Could not delete this file.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>MediLocker</Text>
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
            <Text style={styles.statNumber}>{documents.length}</Text>
            <Text style={styles.statLabel}>Total Documents</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {documents.filter((d) => d.type === 'Lab Report').length}
            </Text>
            <Text style={styles.statLabel}>Lab Reports</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {documents.filter((d) => d.type === 'Prescription').length}
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

        {filteredDocuments.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateTitle}>No uploaded files yet</Text>
            <Text style={styles.emptyStateText}>
              Upload from the MediLens tab and your reports will appear here.
            </Text>
          </View>
        ) : null}

        {filteredDocuments.map((document) => {
          const colors = getDocumentColor(document.type);
          return (
            <TouchableOpacity
              key={document.id}
              style={styles.documentCard}
              onPress={() => openDocument(document.downloadURL)}>
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
                  <Text style={styles.metaText}>{document.fileSizeLabel}</Text>
                </View>
                <Text style={styles.documentDate}>
                  {new Date((document.createdAt?.seconds || 0) * 1000).toLocaleDateString('en-US', {
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

      <TouchableOpacity
        style={styles.floatingAddButton}
        onPress={() => router.push('/(tabs)/medilens')}>
        <Text style={styles.floatingAddButtonText}>=</Text>
      </TouchableOpacity>

      <Modal
        visible={previewDocument !== null}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setPreviewDocument(null)}>
        <View style={styles.previewContainer}>
          <View style={styles.previewHeader}>
            <View style={styles.previewHeaderTextBlock}>
              <Text style={styles.previewTitle} numberOfLines={1}>
                {previewDocument?.title || 'Preview'}
              </Text>
              <Text style={styles.previewSubtitle} numberOfLines={1}>
                {previewDocument?.type || 'Document'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.previewCloseButton}
              onPress={() => setPreviewDocument(null)}>
              <Text style={styles.previewCloseText}>Close</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.previewBody}>
            <View style={styles.previewActionRow}>
              <TouchableOpacity style={styles.previewActionButton} onPress={downloadDocument}>
                <Text style={styles.previewActionButtonText}>Download</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.previewActionButton, styles.previewShareButton]} onPress={shareDocument}>
                <Text style={styles.previewActionButtonText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.previewActionButton, styles.previewDeleteButton]} onPress={deleteDocument}>
                <Text style={styles.previewActionButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>

            {previewDocument?.mimeType.startsWith('image/') ? (
              <Image
                source={{ uri: previewDocument.downloadURL }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            ) : previewDocument?.mimeType === 'application/pdf' ? (
              <WebView
                source={{
                  uri: `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(
                    previewDocument.downloadURL
                  )}`,
                }}
                startInLoadingState
                renderLoading={() => (
                  <View style={styles.previewLoading}>
                    <ActivityIndicator size="large" color="#2563EB" />
                  </View>
                )}
                style={styles.webView}
              />
            ) : (
              <View style={styles.unsupportedPreview}>
                <FileText size={36} color="#2563EB" />
                <Text style={styles.unsupportedTitle}>Preview not available</Text>
                <Text style={styles.unsupportedText}>
                  This file can still be opened in your browser or downloaded from its Cloudinary link.
                </Text>
                <TouchableOpacity
                  style={styles.previewActionButton}
                  onPress={() => previewDocument?.downloadURL && Linking.openURL(previewDocument.downloadURL)}>
                  <Text style={styles.previewActionButtonText}>Open File</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
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
  emptyStateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  emptyStateText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: 56,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  previewHeaderTextBlock: {
    flex: 1,
    marginRight: 12,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  previewSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: '#64748B',
  },
  previewCloseButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
  },
  previewCloseText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '700',
  },
  previewBody: {
    flex: 1,
    padding: 12,
  },
  previewActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  previewImage: {
    width: '100%',
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  webView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  previewLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  unsupportedPreview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    gap: 10,
  },
  unsupportedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  unsupportedText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  previewActionButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewShareButton: {
    backgroundColor: '#1D4ED8',
  },
  previewDeleteButton: {
    backgroundColor: '#DC2626',
  },
  previewActionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  floatingAddButton: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  floatingAddButtonText: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '700',
    marginTop: -3,
  },
});
