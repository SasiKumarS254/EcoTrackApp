codec = dict(
    heatmap_size=(
        64,
        64,
    ),
    input_size=(
        256,
        256,
    ),
    sigma=2,
    type='MSRAHeatmap')
data_mode = 'topdown'
dataset_type = 'AP10KDataset'
default_hooks = dict(
    checkpoint=dict(
        interval=1, rule='greater', save_best='coco/AP',
        type='CheckpointHook'),
    logger=dict(interval=10, type='LoggerHook'),
    param_scheduler=dict(type='ParamSchedulerHook'),
    sampler_seed=dict(type='DistSamplerSeedHook'),
    timer=dict(type='IterTimerHook'))
default_scope = 'mmpose'
env_cfg = dict(
    cudnn_benchmark=False,
    dist_cfg=dict(backend='nccl'),
    mp_cfg=dict(mp_start_method='fork', opencv_num_threads=0))
load_from = 'C:\\Users\\DELL\\EcoTrackApp\\backend\\models\\rtmpose-m_ap10k.pth'
log_level = 'INFO'
log_processor = dict(by_epoch=True, window_size=10)
model = dict(
    backbone=dict(
        extra=dict(
            stage1=dict(
                block='BOTTLENECK',
                num_blocks=(4, ),
                num_branches=1,
                num_channels=(64, ),
                num_modules=1),
            stage2=dict(
                block='BASIC',
                num_blocks=(
                    4,
                    4,
                ),
                num_branches=2,
                num_channels=(
                    32,
                    64,
                ),
                num_modules=1),
            stage3=dict(
                block='BASIC',
                num_blocks=(
                    4,
                    4,
                    4,
                ),
                num_branches=3,
                num_channels=(
                    32,
                    64,
                    128,
                ),
                num_modules=4),
            stage4=dict(
                block='BASIC',
                num_blocks=(
                    4,
                    4,
                    4,
                    4,
                ),
                num_branches=4,
                num_channels=(
                    32,
                    64,
                    128,
                    256,
                ),
                num_modules=3)),
        in_channels=3,
        init_cfg=None,
        type='HRNet'),
    data_preprocessor=dict(
        bgr_to_rgb=True,
        mean=[
            123.675,
            116.28,
            103.53,
        ],
        std=[
            58.395,
            57.12,
            57.375,
        ],
        type='PoseDataPreprocessor'),
    head=dict(
        decoder=dict(
            heatmap_size=(
                64,
                64,
            ),
            input_size=(
                256,
                256,
            ),
            sigma=2,
            type='MSRAHeatmap'),
        deconv_out_channels=None,
        in_channels=32,
        loss=dict(type='KeypointMSELoss', use_target_weight=True),
        out_channels=17,
        type='HeatmapHead'),
    test_cfg=dict(flip_mode='heatmap', flip_test=True, shift_heatmap=True),
    type='TopdownPoseEstimator')
optim_wrapper = dict(
    optimizer=dict(lr=0.0005, type='AdamW', weight_decay=0.01))
param_scheduler = [
    dict(begin=0, by_epoch=False, end=50, start_factor=0.001, type='LinearLR'),
]
test_cfg = dict()
test_dataloader = dict(
    batch_size=8,
    dataset=dict(
        ann_file='val_coco.json',
        data_mode='topdown',
        data_prefix=dict(img='val/images/'),
        data_root=
        'C:\\Users\\DELL\\EcoTrackApp\\backend\\datasets\\yolo_animal_pose',
        pipeline=[
            dict(type='LoadImage'),
            dict(type='GetBBoxCenterScale'),
            dict(input_size=(
                256,
                256,
            ), type='TopdownAffine'),
            dict(type='PackPoseInputs'),
        ],
        test_mode=True,
        type='AP10KDataset'),
    drop_last=False,
    num_workers=0,
    persistent_workers=False,
    sampler=dict(round_up=False, shuffle=False, type='DefaultSampler'))
test_evaluator = dict(
    ann_file=
    'C:\\Users\\DELL\\EcoTrackApp\\backend\\datasets\\yolo_animal_pose\\val_coco.json',
    type='CocoMetric')
train_cfg = dict(max_epochs=1, val_interval=1)
train_dataloader = dict(
    batch_size=8,
    dataset=dict(
        ann_file='train_coco.json',
        data_mode='topdown',
        data_prefix=dict(img='train/images/'),
        data_root=
        'C:\\Users\\DELL\\EcoTrackApp\\backend\\datasets\\yolo_animal_pose',
        pipeline=[
            dict(type='LoadImage'),
            dict(type='GetBBoxCenterScale'),
            dict(direction='horizontal', type='RandomFlip'),
            dict(type='RandomHalfBody'),
            dict(type='RandomBBoxTransform'),
            dict(input_size=(
                256,
                256,
            ), type='TopdownAffine'),
            dict(
                encoder=dict(
                    heatmap_size=(
                        64,
                        64,
                    ),
                    input_size=(
                        256,
                        256,
                    ),
                    sigma=2,
                    type='MSRAHeatmap'),
                type='GenerateTarget'),
            dict(type='PackPoseInputs'),
        ],
        type='AP10KDataset'),
    num_workers=0,
    persistent_workers=False,
    sampler=dict(shuffle=True, type='DefaultSampler'))
val_cfg = dict()
val_dataloader = dict(
    batch_size=8,
    dataset=dict(
        ann_file='val_coco.json',
        data_mode='topdown',
        data_prefix=dict(img='val/images/'),
        data_root=
        'C:\\Users\\DELL\\EcoTrackApp\\backend\\datasets\\yolo_animal_pose',
        pipeline=[
            dict(type='LoadImage'),
            dict(type='GetBBoxCenterScale'),
            dict(input_size=(
                256,
                256,
            ), type='TopdownAffine'),
            dict(type='PackPoseInputs'),
        ],
        test_mode=True,
        type='AP10KDataset'),
    drop_last=False,
    num_workers=0,
    persistent_workers=False,
    sampler=dict(round_up=False, shuffle=False, type='DefaultSampler'))
val_evaluator = dict(
    ann_file=
    'C:\\Users\\DELL\\EcoTrackApp\\backend\\datasets\\yolo_animal_pose\\val_coco.json',
    type='CocoMetric')
vis_backends = [
    dict(type='LocalVisBackend'),
]
visualizer = dict(
    name='visualizer',
    type='PoseLocalVisualizer',
    vis_backends=[
        dict(type='LocalVisBackend'),
    ])
work_dir = 'C:\\Users\\DELL\\EcoTrackApp\\backend\\training_runs\\rtmpose_run'
