import json, torch, sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')

models_dir = Path('backend/models')

# Load training report
report = json.loads((models_dir / 'real_training_report.json').read_text(encoding='utf-8'))
print('=== TRAINING REPORT ===')
print('Model:', report['model_name'])
print('Version:', report['model_version'])
print('Grade Accuracy:', report['metrics']['biomechanics_grade_accuracy'], '%')
print('Species Accuracy:', report['metrics']['species_classification_accuracy'], '%')
print('Form Score MAE:', report['metrics']['form_score_mae_points'], 'pts')
print('Total Samples:', report['training_pipeline']['total_real_samples'])
print()

# Load model weights
for fname in ['aiscanner_model_best.pt', 'species_model_best.pt']:
    try:
        ckpt = torch.load(str(models_dir / fname), map_location='cpu', weights_only=False)
        print(fname + ': LOADED OK')
        if isinstance(ckpt, dict):
            print('  Keys:', list(ckpt.keys()))
        elif hasattr(ckpt, 'state_dict'):
            print('  Type: nn.Module with state_dict')
    except Exception as e:
        print(fname + ' ERROR:', e)
