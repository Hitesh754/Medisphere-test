import { useState } from 'react';
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	ScrollView,
	Alert,
	ActivityIndicator,
	Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { StatusBar } from 'expo-status-bar';
import {
	FileUp,
	CheckCircle2,
	User,
	ClipboardList,
} from 'lucide-react-native';
import { supabase } from '@/components/integrations/supabase/client';
import { auth } from '@/utils/firebase';
import { createFileRecord } from '@/utils/firebaseData';
import { Redirect } from 'expo-router';

const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

const fileToBase64 = (file: File) =>
	new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = reader.result;
			if (typeof result !== 'string') {
				reject(new Error('Could not read selected file.'));
				return;
			}

			const [, base64] = result.split(',');
			if (!base64) {
				reject(new Error('Could not convert file to base64.'));
				return;
			}

			resolve(base64);
		};
		reader.onerror = () => reject(new Error('File reader failed.'));
		reader.readAsDataURL(file);
	});

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

const deriveInsightSeverity = (analysis: LabReportAnalysis | null): 'positive' | 'negative' | 'neutral' => {
	if (!analysis) {
		return 'neutral';
	}

	const text = `${analysis.healthSummary || ''} ${analysis.labResults
		?.map((item) => `${item.status} ${item.testName}`)
		.join(' ') || ''}`.toLowerCase();

	if (/\b(high|low|abnormal|elevated|critical|concerning|urgent|risk|worse|not normal)\b/i.test(text)) {
		return 'negative';
	}

	if (analysis.labResults?.some((item) => item.status !== 'normal')) {
		return 'negative';
	}

	if (analysis.healthSummary?.trim()) {
		return 'positive';
	}

	return 'neutral';
};

const detectDocumentType = (
	fileName: string,
	mimeType: string,
	analysis: LabReportAnalysis | null
): 'Lab Report' | 'Prescription' | 'Vaccination' | 'X-Ray' | 'Document' => {
	const context = `${fileName} ${mimeType} ${analysis?.healthSummary || ''}`.toLowerCase();

	if (/\b(xray|x-ray|radiology|ct\s?scan|mri|chest\s?scan|ultrasound)\b/.test(context)) {
		return 'X-Ray';
	}

	if (/\b(vaccin|vaccination|immunization|booster|covid\s?vaccine|covaxin|covishield)\b/.test(context)) {
		return 'Vaccination';
	}

	if (/\b(prescription|rx|medicine|medication|dose|tablet|capsule|syrup|drug)\b/.test(context)) {
		return 'Prescription';
	}

	if (
		analysis?.labResults?.length ||
		/\b(lab\s?report|blood\s?test|test\s?report|cbc|lipid|hba1c|thyroid|pathology)\b/.test(context)
	) {
		return 'Lab Report';
	}

	return 'Document';
};

export default function MediLensScreen() {
	const [lastUploadedFileName, setLastUploadedFileName] = useState<string | null>(null);
	const [lastUploadedFileType, setLastUploadedFileType] = useState<string>('');
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [analysis, setAnalysis] = useState<LabReportAnalysis | null>(null);

	const uploadFile = async () => {
		if (!auth.currentUser) {
			Alert.alert('Login required', 'Please login to upload and analyze reports.');
			return;
		}

		const result = await DocumentPicker.getDocumentAsync({
			type: '*/*',
			copyToCacheDirectory: true,
			multiple: false,
		});

		if (result.canceled || !result.assets?.[0]) {
			return;
		}

		const asset = result.assets[0];
		const webFile = (asset as any).file as File | undefined;
		const fileMimeType = asset.mimeType || webFile?.type || 'application/octet-stream';
		const fileName = asset.name || `medilens-file-${Date.now()}`;

		try {
			setIsAnalyzing(true);
			setAnalysis(null);

			if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
				throw new Error('Missing Cloudinary env vars: EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET');
			}

			const resourceType = fileMimeType.startsWith('image/') ? 'image' : 'raw';
			const formData = new FormData();

			if (Platform.OS === 'web' && webFile) {
				formData.append('file', webFile, fileName);
			} else {
				formData.append('file', {
					uri: asset.uri,
					type: fileMimeType,
					name: fileName,
				} as any);
			}

			formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
			formData.append('folder', `medisphere/${auth.currentUser.uid}`);

			const cloudinaryResponse = await fetch(
				`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
				{
					method: 'POST',
					body: formData,
				}
			);

			const cloudinaryData = await cloudinaryResponse.json();
			if (!cloudinaryResponse.ok || !cloudinaryData.secure_url) {
				throw new Error(cloudinaryData?.error?.message || 'Cloudinary upload failed');
			}

			const downloadURL = cloudinaryData.secure_url as string;
			const publicId = (cloudinaryData.public_id as string) || fileName;
			const fileSizeBytes = (cloudinaryData.bytes as number) || asset.size || 0;
			let extractedData: LabReportAnalysis | null = null;

			const supportsAnalysis =
				fileMimeType === 'application/pdf' || fileMimeType.startsWith('image/');

			if (supportsAnalysis) {
				const base64 =
					Platform.OS === 'web' && webFile
						? await fileToBase64(webFile)
						: await FileSystem.readAsStringAsync(asset.uri, {
								encoding: 'base64',
						  });

				const { data, error } = await supabase.functions.invoke('extract-lab-report', {
					body: {
						fileBase64: base64,
						mimeType: fileMimeType,
						fileName,
					},
				});

				if (!error && !data?.error) {
					extractedData = data as LabReportAnalysis;
					setAnalysis(extractedData);
				}
			}

			await createFileRecord({
				userId: auth.currentUser.uid,
				title: fileName,
				type: detectDocumentType(fileName, fileMimeType, extractedData),
				mimeType: fileMimeType,
				fileSizeBytes,
				downloadURL,
				storagePath: publicId,
				analysisSummary: extractedData?.healthSummary || '',
				labResultsCount: extractedData?.labResults?.length || 0,
				insightSeverity: deriveInsightSeverity(extractedData),
			});

			setLastUploadedFileName(fileName);
			setLastUploadedFileType(fileMimeType);

			if (supportsAnalysis && extractedData) {
				Alert.alert('Upload complete', 'File uploaded and analyzed successfully.');
			} else if (supportsAnalysis && !extractedData) {
				Alert.alert('Upload complete', 'File uploaded, but analysis could not be completed.');
			} else {
				Alert.alert('Upload complete', 'File uploaded to your locker.');
			}
		} catch (err: any) {
			Alert.alert('Upload failed', err?.message || 'Could not upload this file.');
		} finally {
			setIsAnalyzing(false);
		}
	};

	if (!auth.currentUser) {
		return <Redirect href="/(auth)/login" />;
	}

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
			<Text style={styles.subtitle}>Upload a PDF or any file and store it securely in your locker</Text>

			<View style={styles.uploadCard}>
				<View style={styles.heroIcon}>
					<FileUp size={28} color="#FFFFFF" />
				</View>
				<Text style={styles.uploadTitle}>Upload File</Text>
				<Text style={styles.uploadHint}>
					Use one button to upload PDF, image, or any other document
				</Text>
				<TouchableOpacity
					style={[styles.primaryButton, isAnalyzing && styles.disabledButton]}
					onPress={uploadFile}
					disabled={isAnalyzing}>
					{isAnalyzing ? (
						<ActivityIndicator color="#FFFFFF" />
					) : (
						<>
							<FileUp size={18} color="#FFFFFF" />
							<Text style={styles.primaryButtonText}>Upload File</Text>
						</>
					)}
				</TouchableOpacity>

				{lastUploadedFileName ? (
					<View style={styles.successBox}>
						<CheckCircle2 size={18} color="#16A34A" />
						<Text style={styles.successText}>Uploaded: {lastUploadedFileName}</Text>
					</View>
				) : null}
			</View>

			{lastUploadedFileType ? (
				<Text style={styles.fileTypeText}>File type: {lastUploadedFileType}</Text>
			) : null}

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
	primaryButton: {
		backgroundColor: '#2563EB',
		borderRadius: 12,
		paddingVertical: 12,
		paddingHorizontal: 20,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
		minWidth: 180,
	},
	disabledButton: {
		opacity: 0.7,
	},
	primaryButtonText: {
		color: '#FFFFFF',
		fontWeight: '600',
		fontSize: 14,
	},
	fileTypeText: {
		fontSize: 12,
		color: '#64748B',
		marginTop: 10,
		marginLeft: 2,
	},
	successBox: {
		marginTop: 14,
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
