# ML Final Notes

This prototype uses a CatBoost Regressor trained on the uploaded CarDekho-style dataset. The training file is:

```text
ml_training/train_ml_model.py
```

The trained model artifact is:

```text
model_artifacts/vehicle_price_catboost.cbm
```

The full training report is:

```text
model_artifacts/training_report.json
```

## Why median imputation?

Used-car data is skewed. Price, odometer reading, mileage, and engine capacity can have large outliers. Median is more robust than mean, so it avoids distortion from extreme values.

## Why 70/15/15 split?

- 70% train: model learns patterns
- 15% validation: hyperparameter selection
- 15% test: final unbiased performance

## Hyperparameter tuning

The training report includes low-learning-rate trials and selected model details. Low learning-rate experiments in the 10^-3/10^-2 range were tested. The selected model was chosen by validation R² and generalization behavior.

## Condition pricing fix

Condition is manual input in the final prototype. Computer vision is on hold. Since the dataset does not contain verified condition labels, condition is applied as a monotonic calibration after CatBoost prediction. This prevents Poor condition from producing a higher value than Average for the same vehicle.
