function readUint32BE(bytes, offset) {
    return ((bytes[offset] << 24) >>> 0)
        + (bytes[offset + 1] << 16)
        + (bytes[offset + 2] << 8)
        + bytes[offset + 3];
}

function readVarLengthValue(bytes, startOffset, endOffset) {
    let value = 0;
    let offset = startOffset;

    while (offset < endOffset) {
        const byte = bytes[offset++];
        value = (value << 7) | (byte & 0x7F);
        if ((byte & 0x80) === 0) {
            return { value, offset };
        }
    }

    throw new Error("MIDI 数据损坏：可变长度字段未正常结束");
}

function resolveMidiConstructor() {
    const candidates = [
        window.Midi,
        window.Midi && window.Midi.Midi,
        window.TonejsMidi && window.TonejsMidi.Midi,
    ];

    for (const candidate of candidates) {
        if (typeof candidate === "function") return candidate;
    }

    return null;
}

function buildTempoTimeline(ppq, rawTempos, maxTick) {
    const tempos = [];
    const sortedTempos = [...rawTempos].sort((a, b) => a.ticks - b.ticks);

    let currentMicrosecondsPerQuarter = 500000;
    let lastTick = 0;
    let lastTimeSec = 0;

    tempos.push({
        ticks: 0,
        bpm: 60000000 / currentMicrosecondsPerQuarter,
        time: 0,
    });

    for (const tempoEvent of sortedTempos) {
        const eventTick = Math.max(tempoEvent.ticks, lastTick);
        const deltaTicks = eventTick - lastTick;

        if (deltaTicks > 0) {
            lastTimeSec += (deltaTicks / ppq) * (currentMicrosecondsPerQuarter / 1000000);
        }

        const bpm = 60000000 / tempoEvent.microsecondsPerQuarter;
        if (eventTick === tempos[tempos.length - 1].ticks) {
            tempos[tempos.length - 1] = { ticks: eventTick, bpm, time: lastTimeSec };
        } else {
            tempos.push({ ticks: eventTick, bpm, time: lastTimeSec });
        }

        currentMicrosecondsPerQuarter = tempoEvent.microsecondsPerQuarter;
        lastTick = eventTick;
    }

    const remainingTicks = Math.max(0, maxTick - lastTick);
    const duration = lastTimeSec + (remainingTicks / ppq) * (currentMicrosecondsPerQuarter / 1000000);

    return { tempos, duration };
}

function parseMidiFallback(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    let offset = 0;

    const readChunkType = () => {
        if (offset + 4 > bytes.length) {
            throw new Error("MIDI 数据损坏：Chunk 类型越界");
        }
        const type = String.fromCharCode(
            bytes[offset],
            bytes[offset + 1],
            bytes[offset + 2],
            bytes[offset + 3]
        );
        offset += 4;
        return type;
    };

    if (readChunkType() !== "MThd") {
        throw new Error("不是合法的 MIDI 文件（缺少 MThd 头）");
    }

    if (offset + 4 > bytes.length) {
        throw new Error("MIDI 数据损坏：Header 长度缺失");
    }
    const headerLength = readUint32BE(bytes, offset);
    offset += 4;

    if (offset + headerLength > bytes.length || headerLength < 6) {
        throw new Error("MIDI 数据损坏：Header 长度异常");
    }

    const trackCount = (bytes[offset + 2] << 8) | bytes[offset + 3];
    const division = (bytes[offset + 4] << 8) | bytes[offset + 5];
    const hasSmpteTiming = (division & 0x8000) !== 0;
    if (hasSmpteTiming) {
        throw new Error("暂不支持 SMPTE 时间基准 MIDI");
    }
    const ppq = division || 480;
    offset += headerLength;

    const rawTempos = [];
    let maxTick = 0;

    for (let trackIndex = 0; trackIndex < trackCount; trackIndex++) {
        if (readChunkType() !== "MTrk") {
            throw new Error(`MIDI 数据损坏：第 ${trackIndex + 1} 条轨道缺少 MTrk`);
        }

        if (offset + 4 > bytes.length) {
            throw new Error("MIDI 数据损坏：轨道长度缺失");
        }
        const trackLength = readUint32BE(bytes, offset);
        offset += 4;

        const trackEnd = offset + trackLength;
        if (trackEnd > bytes.length) {
            throw new Error(`MIDI 数据损坏：第 ${trackIndex + 1} 条轨道越界`);
        }

        let tick = 0;
        let runningStatus = 0;

        while (offset < trackEnd) {
            const delta = readVarLengthValue(bytes, offset, trackEnd);
            tick += delta.value;
            offset = delta.offset;

            if (offset >= trackEnd) break;

            let status = bytes[offset++];
            let firstDataByte = null;

            if (status < 0x80) {
                if (!runningStatus) {
                    throw new Error("MIDI 数据损坏：Running Status 缺失");
                }
                firstDataByte = status;
                status = runningStatus;
            } else if (status < 0xF0) {
                runningStatus = status;
            } else {
                runningStatus = 0;
            }

            if (status === 0xFF) {
                if (offset >= trackEnd) {
                    throw new Error("MIDI 数据损坏：Meta 事件类型缺失");
                }
                const metaType = bytes[offset++];
                const metaLengthInfo = readVarLengthValue(bytes, offset, trackEnd);
                const metaLength = metaLengthInfo.value;
                offset = metaLengthInfo.offset;

                if (offset + metaLength > trackEnd) {
                    throw new Error("MIDI 数据损坏：Meta 事件长度越界");
                }

                if (metaType === 0x51 && metaLength === 3) {
                    const microsecondsPerQuarter =
                        (bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2];
                    rawTempos.push({ ticks: tick, microsecondsPerQuarter });
                }

                offset += metaLength;
            } else if (status === 0xF0 || status === 0xF7) {
                const sysexLengthInfo = readVarLengthValue(bytes, offset, trackEnd);
                const sysexLength = sysexLengthInfo.value;
                offset = sysexLengthInfo.offset + sysexLength;
                if (offset > trackEnd) {
                    throw new Error("MIDI 数据损坏：SysEx 事件越界");
                }
            } else {
                const eventType = status >> 4;
                let dataBytes = (eventType === 0xC || eventType === 0xD) ? 1 : 2;
                if (firstDataByte !== null) {
                    dataBytes -= 1;
                }
                offset += dataBytes;
                if (offset > trackEnd) {
                    throw new Error("MIDI 数据损坏：通道事件越界");
                }
            }
        }

        maxTick = Math.max(maxTick, tick);
        offset = trackEnd;
    }

    const tempoInfo = buildTempoTimeline(ppq, rawTempos, maxTick);
    return {
        duration: tempoInfo.duration,
        header: {
            ppq,
            tempos: tempoInfo.tempos,
        },
    };
}

export function parseMidiData(arrayBuffer) {
    const MidiCtor = resolveMidiConstructor();
    if (MidiCtor) {
        try {
            return new MidiCtor(arrayBuffer);
        } catch (error) {
            console.warn("⚠️ 外部 MIDI 库解析失败，改用内置解析器：", error);
        }
    }

    return parseMidiFallback(arrayBuffer);
}
