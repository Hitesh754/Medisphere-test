import { useState } from 'react';
import {
  View, Text, TouchableOpacity, Image,
  ScrollView, StyleSheet, ActivityIndicator, Alert
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Pill, Camera, Image as ImageIcon, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react-native';
import { supabase } from '@/components/integrations/supabase/client';

interface MedicineResult {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  advisory: string;
}

interface ScanResponse {
  medicines: MedicineResult[];
  generalAdvice: string;
  error?: string;
}

export default function PrescriptionsPage() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ScanResponse | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleImage = async (uri: string, base64: string, mimeType: string) => {
    setPreviewUrl(uri);
    setLoading(true);
    setResults(null);
    try {
      const { data, error } = await supabase.functions.invoke('scan-prescription', {
        body: { imageBase64: base64, mimeType },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setResults(data as ScanResponse);
      Alert.alert('Success', `Found ${data.medicines?.length || 0} medicine(s)!`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to scan prescription.');
    } finally {
      setLoading(false);
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      await handleImage(asset.uri, asset.base64!, asset.mimeType || 'image/jpeg');
    }
  };

  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Camera permission is required.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      await handleImage(asset.uri, asset.base64!, asset.mimeType || 'image/jpeg');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Scan Prescription</Text>
      <Text style={styles.subtitle}>Upload or capture a prescription to extract medicine details</Text>

      {!previewUrl && !loading && (
        <View style={styles.uploadCard}>
          <View style={styles.iconBox}>
            <Pill size={28} color="#fff" />
          </View>
          <Text style={styles.uploadTitle}>Upload Prescription</Text>
          <Text style={styles.uploadSubtitle}>Take a photo or choose from gallery</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.primaryButton} onPress={pickFromCamera}>
              <Camera size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.outlineButton} onPress={pickFromGallery}>
              <ImageIcon size={18} color="#2563EB" />
              <Text style={styles.outlineButtonText}>Gallery</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {previewUrl && (
        <View style={styles.previewCard}>
          <Image source={{ uri: previewUrl }} style={styles.previewImage} />
          {loading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#2563EB" />
              <Text style={styles.loadingText}>Analyzing with AI...</Text>
            </View>
          )}
        </View>
      )}

      {results && results.medicines && results.medicines.length > 0 && (
        <View style={styles.resultsContainer}>
          <View style={styles.foundRow}>
            <CheckCircle2 size={20} color="#16a34a" />
            <Text style={styles.foundText}>{results.medicines.length} Medicine(s) Found</Text>
          </View>

          {results.medicines.map((med, i) => (
            <View key={i} style={styles.medicineCard}>
              <View style={styles.medHeader}>
                <View style={styles.medIconBox}>
                  <Pill size={18} color="#fff" />
                </View>
                <View>
                  <Text style={styles.medName}>{med.name}</Text>
                  <Text style={styles.medDosage}>{med.dosage}</Text>
                </View>
              </View>
              <View style={styles.gridRow}>
                <View style={styles.gridItem}>
                  <View style={styles.gridLabel}>
                    <Clock size={12} color="#64748B" />
                    <Text style={styles.gridLabelText}>FREQUENCY</Text>
                  </View>
                  <Text style={styles.gridValue}>{med.frequency}</Text>
                </View>
                <View style={styles.gridItem}>
                  <View style={styles.gridLabel}>
                    <Clock size={12} color="#64748B" />
                    <Text style={styles.gridLabelText}>DURATION</Text>
                  </View>
                  <Text style={styles.gridValue}>{med.duration}</Text>
                </View>
              </View>
              <View style={styles.advisoryBox}>
                <AlertTriangle size={16} color="#d97706" />
                <Text style={styles.advisoryText}>{med.advisory}</Text>
              </View>
            </View>
          ))}

          {results.generalAdvice ? (
            <View style={styles.generalAdvice}>
              <Text style={styles.generalAdviceTitle}>⚕️ General Advisory</Text>
              <Text style={styles.generalAdviceText}>{results.generalAdvice}</Text>
            </View>
          ) : null}

          <TouchableOpacity style={styles.outlineButton} onPress={() => { setResults(null); setPreviewUrl(null); }}>
            <Text style={styles.outlineButtonText}>Scan Another Prescription</Text>
          </TouchableOpacity>
        </View>
      )}

      {results && (!results.medicines || results.medicines.length === 0) && (
        <View style={styles.noResultCard}>
          <AlertTriangle size={32} color="#d97706" />
          <Text style={styles.noResultTitle}>No medicines detected</Text>
          <Text style={styles.noResultText}>{results.generalAdvice || 'Please try a clearer image.'}</Text>
          <TouchableOpacity style={styles.outlineButton} onPress={() => { setResults(null); setPreviewUrl(null); }}>
            <Text style={styles.outlineButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, paddingBottom: 100 },
  title: { fontSize: 24, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#64748B', marginBottom: 20 },
  uploadCard: { backgroundColor: '#fff', borderRadius: 20, padding: 32, alignItems: 'center', borderWidth: 2, borderColor: '#DBEAFE', borderStyle: 'dashed' },
  iconBox: { width: 64, height: 64, borderRadius: 16, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  uploadTitle: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
  uploadSubtitle: { fontSize: 14, color: '#64748B', marginBottom: 16 },
  buttonRow: { flexDirection: 'row', gap: 12 },
  primaryButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#2563EB', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  outlineButton: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#2563EB', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  outlineButtonText: { color: '#2563EB', fontWeight: '600' },
  previewCard: { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', marginBottom: 16 },
  previewImage: { width: '100%', height: 200 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, justifyContent: 'center' },
  loadingText: { color: '#2563EB', fontWeight: '600' },
  resultsContainer: { gap: 12 },
  foundRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  foundText: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  medicineCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 12 },
  medHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  medIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  medName: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  medDosage: { fontSize: 14, color: '#2563EB', fontWeight: '600' },
  gridRow: { flexDirection: 'row', gap: 8 },
  gridItem: { flex: 1, backgroundColor: '#F1F5F9', borderRadius: 10, padding: 10 },
  gridLabel: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  gridLabelText: { fontSize: 10, color: '#64748B', fontWeight: '600' },
  gridValue: { fontSize: 12, fontWeight: '600', color: '#1E293B' },
  advisoryBox: { flexDirection: 'row', gap: 8, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 10, padding: 12 },
  advisoryText: { fontSize: 12, color: '#1E293B', flex: 1 },
  generalAdvice: { backgroundColor: '#EFF6FF', borderRadius: 16, padding: 16 },
  generalAdviceTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  generalAdviceText: { fontSize: 12, color: '#1E293B' },
  noResultCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', gap: 8 },
  noResultTitle: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
  noResultText: { fontSize: 14, color: '#64748B', textAlign: 'center' },
});
