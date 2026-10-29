/** Seedance 素材组及画布文件夹的新建入口，保留原网格尺寸。 */
import { CreateCard } from '../ui';

export default function AddVirtualGroupCard({ onClick, label = '新建素材组' }) {
  return <CreateCard label={label} onClick={onClick} className="max-w-[270px]" />;
}
