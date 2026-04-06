import { useState } from 'react';
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	Image,
	ScrollView,
	Alert,
	ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { StatusBar } from 'expo-status-bar';
import {
	FileUp,
	Camera,
	Image as ImageIcon,
	CheckCircle2,
	User,
	ClipboardList,
	FileText,
} from 'lucide-react-native';
import { supabase } from '@/components/integrations/supabase/client';

interface LabResult {
	testName: string;
	result: string;
	referenceRange: string;
	status: 'normal' | 'high' | 'low' | 'abnormal';
}

interface LabReportAnalysis {
	patientName: string;
	patientDOB: string;
	patientAddress: string;
	patientGender: string;
	orderingPhysician: string;
	labResults: LabResult[];
	collectionDate?: string;
	reportDate?: string;
	labName?: string;
	notes?: string;
	healthSummary: string;
	error?: string;
}

export default function MediLensScreen() {
	const [previewUri, setPreviewUri] = useState<string | null>(null);
	const [base64Data, setBase64Data] = useState<string | null>(null);
	const [mimeType, setMimeType] = useState<string>('image/jpeg');
	const [selectedFileName, setSelectedFileName] = useState<string>('medilens-report.jpg');
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [analysis, setAnalysis] = useState<LabReportAnalysis | null>(null);

	const selectFromGallery = async () => {
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.Images,
			base64: true,
			quality: 0.8,
		});

		if (!result.canceled && result.assets[0]) {
			const asset = result.assets[0];
			setPreviewUri(asset.uri);
			setBase64Data(asset.base64 || null);
			setMimeType(asset.mimeType || 'image/jpeg');
			setSelectedFileName(asset.fileName || 'medilens-report.jpg');
			setAnalysis(null);
		}
	};

	const captureWithCamera = async () => {
		const permission = await ImagePicker.requestCameraPermissionsAsync();
		if (!permission.granted) {
			Alert.alert('Permission needed', 'Please allow camera access to upload reports.');
			return;
		}

		const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.8 });
		if (!result.canceled && result.assets[0]) {
			const asset = result.assets[0];
			setPreviewUri(asset.uri);
			setBase64Data(asset.base64 || null);
			setMimeType(asset.mimeType || 'image/jpeg');
			setSelectedFileName(asset.fileName || 'medilens-report.jpg');
			setAnalysis(null);
		}
	};

	const pickPdfReport = async () => {
		const result = await DocumentPicker.getDocumentAsync({
			type: 'application/pdf',
			copyToCacheDirectory: true,
			multiple: false,
		});

		if (result.canceled || !result.assets?.[0]) {
			return;
		}

		const asset = result.assets[0];

		try {
			const base64 = await FileSystem.readAsStringAsync(asset.uri, {
				encoding: 'base64',
			});

			setPreviewUri(null);
			setBase64Data(base64);
			setMimeType(asset.mimeType || 'application/pdf');
			setSelectedFileName(asset.name || 'medilens-report.pdf');
			setAnalysis(null);
		} catch {
			Alert.alert('File error', 'Could not read the selected PDF file.');
		}
	};

	const analyzeReport = async () => {
		if (!base64Data) {
			Alert.alert('No report selected', 'Choose or capture a report first.');
			return;
		}

		setIsAnalyzing(true);
		setAnalysis(null);

		try {
			const { data, error } = await supabase.functions.invoke('extract-lab-report', {
				body: {
					fileBase64: base64Data,
					mimeType,
					fileName: selectedFileName,
				},
			});

			if (error) {
				throw new Error(error.message);
			}

			if (data?.error) {
				throw new Error(data.error);
			}

			setAnalysis(data as LabReportAnalysis);
			Alert.alert('Analysis complete', 'Report analyzed successfully.');
		} catch (err: any) {
			Alert.alert('Analysis failed', err?.message || 'Could not analyze this report.');
		} finally {
			setIsAnalyzing(false);
		}
	};

	const getStatusStyle = (status: LabResult['status']) => {
		switch (status) {
			case 'normal':
				return { bg: '#DCFCE7', text: '#166534' };
			case 'high':
				return { bg: '#FEE2E2', text: '#991B1B' };
			case 'low':
				return { bg: '#FEF3C7', text: '#92400E' };
			default:
				return { bg: '#E0E7FF', text: '#3730A3' };
		}
	};

	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.content}>
			<StatusBar style="dark" />
			<Text style={styles.title}>MediLens</Text>
			<Text style={styles.subtitle}>Upload a lab report image or PDF and get instant AI analysis</Text>

			{!base64Data && (
				<View style={styles.uploadCard}>
					<View style={styles.heroIcon}>
						<FileUp size={28} color="#FFFFFF" />
					</View>
					<Text style={styles.uploadTitle}>Upload Report</Text>
					<Text style={styles.uploadHint}>Capture an image, pick from gallery, or select a PDF</Text>
					<View style={styles.buttonRow}>
						<TouchableOpacity style={styles.primaryButton} onPress={captureWithCamera}>
							<Camera size={18} color="#FFFFFF" />
							<Text style={styles.primaryButtonText}>Camera</Text>
						</TouchableOpacity>
						<TouchableOpacity style={styles.outlineButton} onPress={selectFromGallery}>
							<ImageIcon size={18} color="#2563EB" />
							<Text style={styles.outlineButtonText}>Gallery</Text>
						</TouchableOpacity>
						<TouchableOpacity style={styles.outlineButton} onPress={pickPdfReport}>
							<FileText size={18} color="#2563EB" />
							<Text style={styles.outlineButtonText}>PDF</Text>
						</TouchableOpacity>
					</View>
				</View>
			)}

			{base64Data && (
				<View style={styles.previewCard}>
					{mimeType === 'application/pdf' ? (
						<View style={styles.pdfPreview}>
							<FileText size={36} color="#2563EB" />
							<Text style={styles.pdfTitle}>PDF Selected</Text>
							<Text style={styles.pdfName}>{selectedFileName}</Text>
						</View>
					) : (
						<Image source={{ uri: previewUri || '' }} style={styles.previewImage} />
					)}

					<View style={styles.actionsContainer}>
						<TouchableOpacity
							style={styles.outlineButton}
							onPress={mimeType === 'application/pdf' ? pickPdfReport : selectFromGallery}>
							{mimeType === 'application/pdf' ? (
								<FileText size={18} color="#2563EB" />
							) : (
								<ImageIcon size={18} color="#2563EB" />
							)}
							<Text style={styles.outlineButtonText}>Change</Text>
						</TouchableOpacity>

						<TouchableOpacity
							style={[styles.primaryButton, isAnalyzing && styles.disabledButton]}
							onPress={analyzeReport}
							disabled={isAnalyzing}>
							{isAnalyzing ? (
								<ActivityIndicator color="#FFFFFF" />
							) : (
								<>
									<FileUp size={18} color="#FFFFFF" />
									<Text style={styles.primaryButtonText}>Analyze</Text>
								</>
							)}
						</TouchableOpacity>
					</View>

					{analysis && (
						<View style={styles.successBox}>
							<CheckCircle2 size={18} color="#16A34A" />
							<Text style={styles.successText}>Report analyzed successfully</Text>
						</View>
					)}
				</View>
			)}

			{analysis && (
				<View style={styles.resultCard}>
					<View style={styles.resultHeader}>
						<User size={18} color="#2563EB" />
						<Text style={styles.resultTitle}>Patient Details</Text>
					</View>
					<Text style={styles.resultLine}>Name: {analysis.patientName || 'not present'}</Text>
					<Text style={styles.resultLine}>DOB: {analysis.patientDOB || 'not present'}</Text>
					<Text style={styles.resultLine}>Gender: {analysis.patientGender || 'not present'}</Text>
					<Text style={styles.resultLine}>Address: {analysis.patientAddress || 'not present'}</Text>
					<Text style={styles.resultLine}>
						Physician: {analysis.orderingPhysician || 'not present'}
					</Text>
					<Text style={styles.resultLine}>Lab: {analysis.labName || 'not present'}</Text>

					<View style={styles.resultHeaderSecondary}>
						<ClipboardList size={18} color="#2563EB" />
						<Text style={styles.resultTitle}>Health Summary</Text>
					</View>
					<Text style={styles.summaryText}>{analysis.healthSummary || 'No summary available'}</Text>

					<View style={styles.resultHeaderSecondary}>
						<ClipboardList size={18} color="#2563EB" />
						<Text style={styles.resultTitle}>Lab Results</Text>
					</View>

					{analysis.labResults?.length ? (
						analysis.labResults.map((item, idx) => {
							const statusStyle = getStatusStyle(item.status);
							return (
								<View key={`${item.testName}-${idx}`} style={styles.labRow}>
									<View style={styles.labRowHeader}>
										<Text style={styles.labTestName}>{item.testName}</Text>
										<View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
											<Text style={[styles.statusText, { color: statusStyle.text }]}>{item.status}</Text>
										</View>
									</View>
									<Text style={styles.labMeta}>Result: {item.result}</Text>
									<Text style={styles.labMeta}>Reference: {item.referenceRange}</Text>
								</View>
							);
						})
					) : (
						<Text style={styles.resultLine}>No lab results extracted.</Text>
					)}
				</View>
			)}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#F8FAFC',
	},
	content: {
		padding: 20,
		paddingBottom: 100,
	},
	title: {
		fontSize: 28,
		fontWeight: '700',
		color: '#1E293B',
		marginBottom: 6,
	},
	subtitle: {
		fontSize: 14,
		color: '#64748B',
		marginBottom: 20,
	},
	uploadCard: {
		backgroundColor: '#FFFFFF',
		borderRadius: 20,
		borderWidth: 2,
		borderColor: '#DBEAFE',
		borderStyle: 'dashed',
		alignItems: 'center',
		padding: 28,
	},
	heroIcon: {
		width: 64,
		height: 64,
		borderRadius: 16,
		backgroundColor: '#2563EB',
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: 14,
	},
	uploadTitle: {
		fontSize: 18,
		fontWeight: '700',
		color: '#1E293B',
		marginBottom: 6,
	},
	uploadHint: {
		fontSize: 14,
		color: '#64748B',
		marginBottom: 16,
		textAlign: 'center',
	},
	buttonRow: {
		flexDirection: 'row',
		gap: 12,
	},
	primaryButton: {
		backgroundColor: '#2563EB',
		borderRadius: 12,
		paddingVertical: 12,
		paddingHorizontal: 20,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
		minWidth: 120,
	},
	disabledButton: {
		opacity: 0.7,
	},
	primaryButtonText: {
		color: '#FFFFFF',
		fontWeight: '600',
		fontSize: 14,
	},
	outlineButton: {
		borderWidth: 1,
		borderColor: '#2563EB',
		borderRadius: 12,
		paddingVertical: 12,
		paddingHorizontal: 20,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
		minWidth: 120,
		backgroundColor: '#FFFFFF',
	},
	outlineButtonText: {
		color: '#2563EB',
		fontWeight: '600',
		fontSize: 14,
	},
	previewCard: {
		backgroundColor: '#FFFFFF',
		borderRadius: 16,
		overflow: 'hidden',
	},
	previewImage: {
		width: '100%',
		height: 260,
	},
	pdfPreview: {
		height: 220,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 16,
		gap: 8,
		backgroundColor: '#EFF6FF',
	},
	pdfTitle: {
		fontSize: 16,
		fontWeight: '700',
		color: '#1E293B',
	},
	pdfName: {
		fontSize: 13,
		color: '#475569',
		textAlign: 'center',
	},
	actionsContainer: {
		padding: 14,
		flexDirection: 'row',
		justifyContent: 'space-between',
		gap: 10,
	},
	successBox: {
		marginHorizontal: 14,
		marginBottom: 14,
		backgroundColor: '#F0FDF4',
		borderRadius: 10,
		paddingVertical: 10,
		paddingHorizontal: 12,
		borderWidth: 1,
		borderColor: '#BBF7D0',
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	successText: {
		color: '#15803D',
		fontSize: 13,
		fontWeight: '600',
	},
	resultCard: {
		backgroundColor: '#FFFFFF',
		borderRadius: 16,
		padding: 16,
		marginTop: 16,
		gap: 8,
	},
	resultHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		marginBottom: 2,
	},
	resultHeaderSecondary: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		marginTop: 10,
		marginBottom: 2,
	},
	resultTitle: {
		fontSize: 15,
		fontWeight: '700',
		color: '#1E293B',
	},
	resultLine: {
		fontSize: 13,
		color: '#334155',
	},
	summaryText: {
		fontSize: 13,
		color: '#1E293B',
		lineHeight: 18,
	},
	labRow: {
		backgroundColor: '#F8FAFC',
		borderRadius: 10,
		padding: 10,
		gap: 4,
	},
	labRowHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 8,
	},
	labTestName: {
		fontSize: 13,
		fontWeight: '700',
		color: '#1E293B',
		flex: 1,
	},
	labMeta: {
		fontSize: 12,
		color: '#475569',
	},
	statusPill: {
		paddingHorizontal: 8,
		paddingVertical: 3,
		borderRadius: 20,
	},
	statusText: {
		fontSize: 11,
		fontWeight: '700',
		textTransform: 'capitalize',
	},
});
