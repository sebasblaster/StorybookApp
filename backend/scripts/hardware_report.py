"""Print the hardware / software table the project report must include (CPU, RAM, GPU, versions)."""
import os
import platform
import sys
from importlib.metadata import PackageNotFoundError, version


def ram_gb() -> str:
    if sys.platform.startswith("linux"):
        try:
            with open("/proc/meminfo", encoding="ascii") as info:
                kb = int(next(line for line in info if line.startswith("MemTotal")).split()[1])
        except (OSError, StopIteration, ValueError) as exc:
            return f"desconocida ({exc})"
        return f"{kb / 1e6:.1f}"

    if sys.platform == "win32":
        import ctypes

        class MemoryStatusEx(ctypes.Structure):
            _fields_ = [
                ("dwLength", ctypes.c_ulong),
                ("dwMemoryLoad", ctypes.c_ulong),
                ("ullTotalPhys", ctypes.c_ulonglong),
                ("ullAvailPhys", ctypes.c_ulonglong),
                ("ullTotalPageFile", ctypes.c_ulonglong),
                ("ullAvailPageFile", ctypes.c_ulonglong),
                ("ullTotalVirtual", ctypes.c_ulonglong),
                ("ullAvailVirtual", ctypes.c_ulonglong),
                ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
            ]

        memory = MemoryStatusEx()
        memory.dwLength = ctypes.sizeof(MemoryStatusEx)
        if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(memory)):
            raise ctypes.WinError()
        return f"{memory.ullTotalPhys / 1e9:.1f}"

    return "desconocida (instala psutil para medirla)"


def pkg(name: str) -> str:
    try:
        return version(name)
    except PackageNotFoundError:
        return "no instalado"


def main() -> None:
    print("| Elemento | Valor |\n|---|---|")
    print(f"| Sistema operativo | {platform.platform()} |")
    print(f"| CPU | {platform.processor() or platform.machine()} ({os.cpu_count()} hilos) |")
    print(f"| RAM | {ram_gb()} GB |")
    print(f"| Python | {platform.python_version()} |")
    try:
        import torch

        print(f"| PyTorch | {torch.__version__} (CUDA {torch.version.cuda}) |")
        if torch.cuda.is_available():
            p = torch.cuda.get_device_properties(0)
            print(f"| GPU | {p.name} · {p.total_memory / 1e9:.1f} GB VRAM |")
        else:
            print("| GPU | ninguna (CUDA no disponible: se usará CPU) |")
    except ImportError:
        print("| PyTorch | no instalado |")
    for p in ("transformers", "diffusers", "accelerate", "huggingface_hub", "bitsandbytes", "fastapi", "reportlab"):
        print(f"| {p} | {pkg(p)} |")


if __name__ == "__main__":
    main()
