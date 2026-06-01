import {
  ArrowDown,
  ArrowUp,
  Clock,
  Copy,
  ExternalLink,
  FileImage,
  Film,
  FolderOpen,
  Image,
  Loader2,
  Maximize2,
  Minus,
  Plus,
  RefreshCw,
  Scissors,
  Sparkles,
  Trash2,
  Video,
  Wand2,
  X
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent, type MouseEvent } from 'react';
import type {
  ImagineAsset,
  ImagineGenerateRequest,
  ImagineMode,
  ImagineRunEvent,
  ImagineStitchRequest,
  SecretStatus,
  WorkspaceInfo
} from '@shared/types';

interface ImaginePanelProps {
  workspace: WorkspaceInfo | null;
  secretStatus: SecretStatus;
  assets: ImagineAsset[];
  events: ImagineRunEvent[];
  isGenerating: boolean;
  isStitching: boolean;
  onGenerate: (request: ImagineGenerateRequest) => Promise<void>;
  onStitch: (request: ImagineStitchRequest) => Promise<void>;
  onRefresh: () => Promise<void>;
  onOpenAsset: (assetPath: string) => Promise<void>;
}

interface ImagineModeOption {
  id: ImagineMode;
  label: string;
  description: string;
  icon: JSX.Element;
  needsSources: boolean;
}

const MODE_OPTIONS: ImagineModeOption[] = [
  {
    id: 'image-generate',
    label: 'Image',
    description: 'Text to image',
    icon: <Image size={14} />,
    needsSources: false
  },
  {
    id: 'image-edit',
    label: 'Edit',
    description: 'Prompt plus source image',
    icon: <Wand2 size={14} />,
    needsSources: true
  },
  {
    id: 'video-generate',
    label: 'Video',
    description: 'Text to video',
    icon: <Video size={14} />,
    needsSources: false
  },
  {
    id: 'image-to-video',
    label: 'I2V',
    description: 'Animate one image',
    icon: <FileImage size={14} />,
    needsSources: true
  },
  {
    id: 'reference-to-video',
    label: 'Refs',
    description: 'Guide video with images',
    icon: <Film size={14} />,
    needsSources: true
  }
];

export function ImaginePanel({
  workspace,
  secretStatus,
  assets,
  events,
  isGenerating,
  isStitching,
  onGenerate,
  onStitch,
  onRefresh,
  onOpenAsset
}: ImaginePanelProps): JSX.Element {
  const [mode, setMode] = useState<ImagineMode>('image-generate');
  const [prompt, setPrompt] = useState('');
  const [outputFolder, setOutputFolder] = useState('assets/imagine');
  const [filenamePrefix, setFilenamePrefix] = useState('grok-imagine');
  const [imageCount, setImageCount] = useState(1);
  const [imageAspectRatio, setImageAspectRatio] = useState<ImagineGenerateRequest['imageAspectRatio']>('1:1');
  const [imageResolution, setImageResolution] = useState<ImagineGenerateRequest['imageResolution']>('1k');
  const [videoAspectRatio, setVideoAspectRatio] = useState<ImagineGenerateRequest['videoAspectRatio']>('16:9');
  const [videoDuration, setVideoDuration] = useState<ImagineGenerateRequest['videoDuration']>(6);
  const [videoResolution, setVideoResolution] = useState<ImagineGenerateRequest['videoResolution']>('720p');
  const [sourcePaths, setSourcePaths] = useState<string[]>([]);
  const [copiedPath, setCopiedPath] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<ImagineAsset | null>(null);
  const [stitchAssetIds, setStitchAssetIds] = useState<string[]>([]);
  const [stitchOutputFolder, setStitchOutputFolder] = useState('assets/imagine');
  const [stitchFilenamePrefix, setStitchFilenamePrefix] = useState('grok-stitch');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedMode = MODE_OPTIONS.find((option) => option.id === mode) ?? MODE_OPTIONS[0];
  const latestEvent = events[0];
  const canGenerate = Boolean(workspace && secretStatus.xai && prompt.trim()) && !isGenerating && (!selectedMode.needsSources || sourcePaths.length > 0);
  const galleryGroups = useMemo(() => ({
    images: assets.filter((asset) => asset.kind === 'image'),
    videos: assets.filter((asset) => asset.kind === 'video')
  }), [assets]);
  const stitchQueue = useMemo(() => stitchAssetIds
    .map((assetId) => assets.find((asset) => asset.id === assetId && asset.kind === 'video'))
    .filter((asset): asset is ImagineAsset => Boolean(asset)), [assets, stitchAssetIds]);
  const canStitch = Boolean(workspace) && stitchQueue.length >= 2 && !isGenerating && !isStitching;

  useEffect(() => {
    if (selectedAsset && !assets.some((asset) => asset.id === selectedAsset.id)) {
      setSelectedAsset(null);
    }
    setStitchAssetIds((current) => current.filter((assetId) => assets.some((asset) => asset.id === assetId && asset.kind === 'video')));
  }, [assets, selectedAsset]);

  useEffect(() => {
    if (!selectedAsset) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setSelectedAsset(null);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAsset]);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();

    if (!workspace || !canGenerate) {
      return;
    }

    await onGenerate({
      runId: crypto.randomUUID(),
      workspacePath: workspace.path,
      mode,
      prompt: prompt.trim(),
      outputFolder: outputFolder.trim() || 'assets/imagine',
      filenamePrefix: filenamePrefix.trim() || 'grok-imagine',
      sourcePaths,
      imageCount,
      imageAspectRatio,
      imageResolution,
      videoAspectRatio,
      videoDuration,
      videoResolution
    });
  }

  function pickSources(): void {
    fileInputRef.current?.click();
  }

  function addSourceFiles(files: FileList | File[]): void {
    const paths = window.workshop.resolveFilePaths(Array.from(files));
    setSourcePaths((current) => mergeSources(current, paths).slice(0, sourceLimitForMode(mode)));
  }

  function clearSource(sourcePath: string): void {
    setSourcePaths((paths) => paths.filter((path) => path !== sourcePath));
  }

  function handleDragOver(event: DragEvent<HTMLElement>): void {
    event.preventDefault();
    event.dataTransfer.dropEffect = workspace && !isGenerating ? 'copy' : 'none';
  }

  function handleDrop(event: DragEvent<HTMLElement>): void {
    event.preventDefault();

    if (!workspace || isGenerating) {
      return;
    }

    addSourceFiles(event.dataTransfer.files);
  }

  async function copyPath(asset: ImagineAsset): Promise<void> {
    await navigator.clipboard.writeText(asset.path);
    setCopiedPath(asset.path);
    window.setTimeout(() => setCopiedPath(''), 1200);
  }

  function stopModalEvent(event: MouseEvent<HTMLElement>): void {
    event.stopPropagation();
  }

  function toggleStitchAsset(asset: ImagineAsset): void {
    setStitchAssetIds((current) => {
      if (current.includes(asset.id)) {
        return current.filter((assetId) => assetId !== asset.id);
      }

      return [...current, asset.id];
    });
  }

  function moveStitchAsset(assetId: string, direction: -1 | 1): void {
    setStitchAssetIds((current) => {
      const index = current.indexOf(assetId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  async function stitchVideos(): Promise<void> {
    if (!workspace || !canStitch) {
      return;
    }

    await onStitch({
      runId: crypto.randomUUID(),
      workspacePath: workspace.path,
      videoPaths: stitchQueue.map((asset) => asset.path),
      outputFolder: stitchOutputFolder.trim() || 'assets/imagine',
      filenamePrefix: stitchFilenamePrefix.trim() || 'grok-stitch'
    });
    setStitchAssetIds([]);
  }

  return (
    <section className="panel imagine-panel" onDragOver={handleDragOver} onDrop={handleDrop}>
      <div className="project-tools-header">
        <div>
          <span className="eyebrow">Imagine</span>
          <h2>Media suite</h2>
        </div>
        <button className="icon-button" title="Refresh generated assets" disabled={!workspace} onClick={() => void onRefresh()}>
          <RefreshCw size={15} />
        </button>
      </div>

      <form className="imagine-workbench" onSubmit={submit}>
        <div className="imagine-mode-grid" role="tablist" aria-label="Imagine mode">
          {MODE_OPTIONS.map((option) => (
            <button
              aria-selected={mode === option.id}
              className={`imagine-mode-button ${mode === option.id ? 'active' : ''}`}
              key={option.id}
              onClick={() => {
                setMode(option.id);
                if (option.id === 'image-generate' || option.id === 'video-generate') {
                  setSourcePaths([]);
                }
                if (option.id === 'image-to-video' || option.id === 'image-edit') {
                  setSourcePaths((paths) => paths.slice(0, sourceLimitForMode(option.id)));
                }
              }}
              role="tab"
              type="button"
            >
              {option.icon}
              <span>{option.label}</span>
              <small>{option.description}</small>
            </button>
          ))}
        </div>

        <label className="imagine-prompt">
          <span>Prompt</span>
          <textarea
            value={prompt}
            placeholder="Describe the asset Grok should generate..."
            disabled={isGenerating}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </label>

        {selectedMode.needsSources ? (
          <section className="imagine-source-zone">
            <div className="imagine-source-header">
              <span>{mode === 'image-to-video' ? 'Source image' : 'Source images'}</span>
              <button className="secondary-action" disabled={!workspace || isGenerating} onClick={pickSources} type="button">
                <FolderOpen size={14} />
                Add
              </button>
            </div>
            {sourcePaths.length ? (
              <div className="imagine-source-list">
                {sourcePaths.map((sourcePath) => (
                  <div className="imagine-source-chip" key={sourcePath} title={sourcePath}>
                    <FileImage size={13} />
                    <span>{fileName(sourcePath)}</span>
                    <button title="Remove source image" type="button" onClick={() => clearSource(sourcePath)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-copy">Drop image files here or use Add to choose references.</p>
            )}
          </section>
        ) : null}

        <input
          ref={fileInputRef}
          className="hidden-file-input"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple={mode !== 'image-to-video'}
          onChange={(event) => {
            if (event.currentTarget.files) {
              addSourceFiles(event.currentTarget.files);
            }
            event.currentTarget.value = '';
          }}
        />

        <div className="imagine-options">
          <label>
            <span>Folder</span>
            <input value={outputFolder} disabled={isGenerating} onChange={(event) => setOutputFolder(event.target.value)} />
          </label>
          <label>
            <span>Name prefix</span>
            <input value={filenamePrefix} disabled={isGenerating} onChange={(event) => setFilenamePrefix(event.target.value)} />
          </label>

          {mode === 'image-generate' || mode === 'image-edit' ? (
            <>
              <label>
                <span>Count</span>
                <select value={imageCount} disabled={isGenerating || mode === 'image-edit'} onChange={(event) => setImageCount(Number(event.target.value))}>
                  {[1, 2, 3, 4].map((count) => (
                    <option value={count} key={count}>{count}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Image quality</span>
                <select value={imageResolution} disabled={isGenerating} onChange={(event) => setImageResolution(event.target.value as ImagineGenerateRequest['imageResolution'])}>
                  <option value="1k">1K</option>
                  <option value="2k">2K</option>
                </select>
              </label>
              <label>
                <span>Aspect</span>
                <select value={imageAspectRatio} disabled={isGenerating || mode === 'image-edit'} onChange={(event) => setImageAspectRatio(event.target.value as ImagineGenerateRequest['imageAspectRatio'])}>
                  <option value="1:1">1:1</option>
                  <option value="16:9">16:9</option>
                  <option value="9:16">9:16</option>
                  <option value="4:3">4:3</option>
                  <option value="3:4">3:4</option>
                </select>
              </label>
            </>
          ) : (
            <>
              <label>
                <span>Duration</span>
                <select value={videoDuration} disabled={isGenerating} onChange={(event) => setVideoDuration(Number(event.target.value) as ImagineGenerateRequest['videoDuration'])}>
                  <option value={6}>6 sec</option>
                  <option value={10}>10 sec</option>
                  <option value={15}>15 sec</option>
                </select>
              </label>
              <label>
                <span>Video aspect</span>
                <select value={videoAspectRatio} disabled={isGenerating} onChange={(event) => setVideoAspectRatio(event.target.value as ImagineGenerateRequest['videoAspectRatio'])}>
                  <option value="16:9">16:9</option>
                  <option value="9:16">9:16</option>
                  <option value="1:1">1:1</option>
                </select>
              </label>
              <label>
                <span>Resolution</span>
                <select value={videoResolution} disabled={isGenerating} onChange={(event) => setVideoResolution(event.target.value as ImagineGenerateRequest['videoResolution'])}>
                  <option value="480p">480p</option>
                  <option value="720p">720p</option>
                </select>
              </label>
            </>
          )}
        </div>

        <div className="imagine-submit-row">
          <span>{statusText(workspace, secretStatus, latestEvent)}</span>
          <button className="primary-action" disabled={!canGenerate} type="submit">
            {isGenerating ? <Loader2 className="spin-icon" size={15} /> : <Sparkles size={15} />}
            Generate
          </button>
        </div>
      </form>

      {events.length ? (
        <section className="imagine-events">
          {events.slice(0, 4).map((event) => (
            <div className={`imagine-event ${event.phase}`} key={`${event.runId}-${event.createdAt}`}>
              <Clock size={13} />
              <span>{event.message}</span>
            </div>
          ))}
        </section>
      ) : null}

      <section className="imagine-stitcher">
        <div className="subsection-title compact">
          <span>
            <Scissors size={14} />
            Video stitcher
          </span>
          <span>{stitchQueue.length}</span>
        </div>
        {stitchQueue.length ? (
          <div className="imagine-stitch-list">
            {stitchQueue.map((asset, index) => (
              <div className="imagine-stitch-row" key={asset.id}>
                <span>{index + 1}</span>
                <strong title={asset.name}>{asset.name}</strong>
                <button className="icon-button" title="Move earlier" disabled={index === 0 || isStitching} onClick={() => moveStitchAsset(asset.id, -1)} type="button">
                  <ArrowUp size={13} />
                </button>
                <button className="icon-button" title="Move later" disabled={index === stitchQueue.length - 1 || isStitching} onClick={() => moveStitchAsset(asset.id, 1)} type="button">
                  <ArrowDown size={13} />
                </button>
                <button className="icon-button danger" title="Remove from stitch queue" disabled={isStitching} onClick={() => toggleStitchAsset(asset)} type="button">
                  <Minus size={13} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-copy">Use the Queue buttons on video gallery items to build a longer MP4.</p>
        )}
        <div className="imagine-stitch-options">
          <label>
            <span>Folder</span>
            <input value={stitchOutputFolder} disabled={isStitching} onChange={(event) => setStitchOutputFolder(event.target.value)} />
          </label>
          <label>
            <span>Name prefix</span>
            <input value={stitchFilenamePrefix} disabled={isStitching} onChange={(event) => setStitchFilenamePrefix(event.target.value)} />
          </label>
          <button className="primary-action" disabled={!canStitch} onClick={() => void stitchVideos()} type="button">
            {isStitching ? <Loader2 className="spin-icon" size={15} /> : <Scissors size={15} />}
            Export MP4
          </button>
        </div>
      </section>

      <section className="imagine-gallery">
        <div className="subsection-title compact">
          <span>
            <Sparkles size={14} />
            Gallery
          </span>
          <span>{assets.length}</span>
        </div>
        {assets.length ? (
          <div className="imagine-gallery-grid">
            {[...galleryGroups.images, ...galleryGroups.videos].map((asset) => (
              <article className="imagine-asset-card" key={asset.id}>
                <button className="imagine-asset-preview imagine-asset-preview-button" title={`Preview ${asset.name}`} onClick={() => setSelectedAsset(asset)} type="button">
                  {asset.kind === 'image' ? (
                    <img src={assetUrl(asset.path)} alt="" />
                  ) : (
                    <video src={assetUrl(asset.path)} muted preload="metadata" />
                  )}
                  <span className="imagine-preview-hint">
                    <Maximize2 size={13} />
                  </span>
                </button>
                <div className="imagine-asset-meta">
                  <strong title={asset.name}>{asset.name}</strong>
                  <span>{asset.mode.replace(/-/g, ' ')} - {formatBytes(asset.size)}</span>
                </div>
                <div className="imagine-asset-actions">
                  <button className="bubble-copy" title="Copy file path" onClick={() => void copyPath(asset)} type="button">
                    <Copy size={12} />
                    <span>{copiedPath === asset.path ? 'Copied' : 'Path'}</span>
                  </button>
                  <button className="bubble-copy" title="Open generated asset" onClick={() => void onOpenAsset(asset.path)} type="button">
                    <ExternalLink size={12} />
                    <span>Open</span>
                  </button>
                  {asset.kind === 'video' ? (
                    <button className="bubble-copy" title="Add video to stitch queue" onClick={() => toggleStitchAsset(asset)} type="button">
                      {stitchAssetIds.includes(asset.id) ? <Minus size={12} /> : <Plus size={12} />}
                      <span>{stitchAssetIds.includes(asset.id) ? 'Queued' : 'Queue'}</span>
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-copy">Generated images and videos will appear here after they are saved into the workspace.</p>
        )}
      </section>

      {selectedAsset ? (
        <div className="imagine-lightbox-overlay" role="presentation" onMouseDown={() => setSelectedAsset(null)}>
          <section className="imagine-lightbox" role="dialog" aria-modal="true" aria-label="Media preview" onMouseDown={stopModalEvent}>
            <header className="imagine-lightbox-header">
              <div>
                <span className="eyebrow">{selectedAsset.kind}</span>
                <h2 title={selectedAsset.name}>{selectedAsset.name}</h2>
              </div>
              <div className="imagine-lightbox-actions">
                <button className="bubble-copy" title="Copy file path" onClick={() => void copyPath(selectedAsset)} type="button">
                  <Copy size={13} />
                  <span>{copiedPath === selectedAsset.path ? 'Copied' : 'Path'}</span>
                </button>
                <button className="bubble-copy" title="Open generated asset" onClick={() => void onOpenAsset(selectedAsset.path)} type="button">
                  <ExternalLink size={13} />
                  <span>Open</span>
                </button>
                <button className="icon-button" title="Close preview" onClick={() => setSelectedAsset(null)} type="button">
                  <X size={16} />
                </button>
              </div>
            </header>
            <div className="imagine-lightbox-stage">
              {selectedAsset.kind === 'image' ? (
                <img src={assetUrl(selectedAsset.path)} alt="" />
              ) : (
                <video src={assetUrl(selectedAsset.path)} controls autoPlay />
              )}
            </div>
            <footer className="imagine-lightbox-footer">
              <span>{selectedAsset.mode.replace(/-/g, ' ')}</span>
              <span>{formatBytes(selectedAsset.size)}</span>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function mergeSources(current: string[], incoming: string[]): string[] {
  const seen = new Set(current.map((value) => value.toLowerCase()));
  const merged = [...current];

  for (const sourcePath of incoming) {
    const key = sourcePath.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(sourcePath);
    }
  }

  return merged;
}

function sourceLimitForMode(mode: ImagineMode): number {
  if (mode === 'image-to-video') {
    return 1;
  }

  if (mode === 'image-edit') {
    return 3;
  }

  return 7;
}

function statusText(workspace: WorkspaceInfo | null, secretStatus: SecretStatus, latestEvent?: ImagineRunEvent): string {
  if (!workspace) {
    return 'Open a workspace first.';
  }

  if (!secretStatus.xai) {
    return 'Save an xAI key before generating media.';
  }

  return latestEvent?.message ?? 'Outputs save into the open workspace.';
}

function assetUrl(filePath: string): string {
  return encodeURI(`file:///${filePath.replace(/\\/g, '/')}`);
}

function fileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
