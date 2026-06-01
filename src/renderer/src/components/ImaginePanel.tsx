import {
  Clock,
  Copy,
  ExternalLink,
  FileImage,
  Film,
  FolderOpen,
  Image,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  Video,
  Wand2
} from 'lucide-react';
import { useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react';
import type {
  ImagineAsset,
  ImagineGenerateRequest,
  ImagineMode,
  ImagineRunEvent,
  SecretStatus,
  WorkspaceInfo
} from '@shared/types';

interface ImaginePanelProps {
  workspace: WorkspaceInfo | null;
  secretStatus: SecretStatus;
  assets: ImagineAsset[];
  events: ImagineRunEvent[];
  isGenerating: boolean;
  onGenerate: (request: ImagineGenerateRequest) => Promise<void>;
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
  onGenerate,
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedMode = MODE_OPTIONS.find((option) => option.id === mode) ?? MODE_OPTIONS[0];
  const latestEvent = events[0];
  const canGenerate = Boolean(workspace && secretStatus.xai && prompt.trim()) && !isGenerating && (!selectedMode.needsSources || sourcePaths.length > 0);
  const galleryGroups = useMemo(() => ({
    images: assets.filter((asset) => asset.kind === 'image'),
    videos: assets.filter((asset) => asset.kind === 'video')
  }), [assets]);

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
                <div className="imagine-asset-preview">
                  {asset.kind === 'image' ? (
                    <img src={assetUrl(asset.path)} alt="" />
                  ) : (
                    <video src={assetUrl(asset.path)} muted controls />
                  )}
                </div>
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
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-copy">Generated images and videos will appear here after they are saved into the workspace.</p>
        )}
      </section>
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
