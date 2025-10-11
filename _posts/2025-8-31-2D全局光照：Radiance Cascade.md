---
title: 2D全局光照：Radiance Cascade
date: 2025-8-31
categories: 图形学
layout: post
---
Radiance Cascades是一个全局光照方法，通过更加明智的采样方法，估计经典的积分：

$$

F(\mathbf{p})=\int^{2\pi}_0{L(\mathbf{p},\vec{\omega}(\theta))}\mathrm{d}\theta

$$

要了解最近的发展，请看：[[2505.02041] Holographic Radiance Cascades for 2D Global Illumination](https://arxiv.org/abs/2505.02041)。这是一个改进的方法，与原始方法相比，伪影上表现更好。

我已利用Compute Shader实现了原始版本的Radiance Cascades，参照[这里](https://github.com/Raikiri/RadianceCascadesPaper)的paper。效果如图：
![rc1](/assets/post-images/rc1.png)
![rc2](/assets/post-images/rc2.png)
具体代码：
```hlsl
#pragma kernel CascadeMerge
#pragma kernel CascadeFinal

// x: distance, yzw: emit
Texture2D<float4> _SDF;
SamplerState sampler_SDF
{
    Filter = MIN_MAG_LINEAR_MIP_POINT;
    AddressU = Border;
    AddressV = Border;
    BorderColor = float4(0., 0., 0., float(0x1FFFFFFF));
};

float2 _Size;
uint _CascadeId;
uint _DirectionCount;
uint _IntervalLength;
float3 _SunColor;
float _SunDirection;
Texture2D<float4> _LastCascade;
SamplerState sampler_LastCascade
{
    Filter = MIN_MAG_LINEAR_MIP_POINT;
    AddressU = Clamp;
    AddressV = Clamp;
};
RWTexture2D<float4> _Result;

float4 SampleTextureHalfPixel(Texture2D<float4> tex, SamplerState samplerState, float2 p, float2 size)
{
    float2 uv = (p + 0.5) / size;
    return tex.SampleLevel(samplerState, uv, 0);
}

float4 SampleTexture(Texture2D<float4> tex, SamplerState samplerState, float2 p, float2 size)
{
    float2 uv = p / size;
    return tex.SampleLevel(samplerState, uv, 0);
}

float4 LoadOffsetedTextureClamped(Texture2D<float4> tex, float2 origin, float2 offset, float2 size1, float2 size2)
{
    offset = clamp(offset, 0, size1 - 1);
    return tex[clamp(origin + offset, 0, size2 - 1)];
}

// We have to use ray marching
// returns: x: L_tMax(o, d), w: beta_tMax(o, d)
float4 RadianceInterval(float2 o, float2 d, float tMax)
{
    float4 p = SampleTextureHalfPixel(_SDF, sampler_SDF, o, _Size);
    if (p.x > 0.001)
    {
        float t = 0.;
        for (int i = 0; i < 100; i++)
        {
            t += p.x;
            float2 x = o + t * d;
            float2 floorX = floor(x);
            if (any(floorX < 0.) || any(floorX > _Size) || t > tMax)
                break;
            // p = _SDF[x];
            p = SampleTextureHalfPixel(_SDF, sampler_SDF, x, _Size);
            if (t > 0.1 && p.x <= 0)
            {
                return float4(p.yzw, 0.);
            }
        }
        return float4(0., 0., 0., 1.);
    }
    return float4(p.yzw, 0.);
}

float3 FetchLastCascade(uint k, uint2 offset, uint sqrtNDirection)
{
    float2 nProbe = ceil(_Size / (1 << (_CascadeId + 1)));
    float2 cascadeOffset = clamp(offset / 2. + 0.25, 0.5, nProbe - 0.5);
    float2 ij = float2(k % sqrtNDirection, k / sqrtNDirection);
    float2 cascadeOrigin = ij * nProbe;
    return SampleTexture(_LastCascade, sampler_LastCascade, cascadeOrigin + cascadeOffset, _Size).xyz;
}

// L_{t0,t2} = L_{t0,t1} + beta_{t0,t1} * L_{t1,t2}, as t0 < t1 < t2 
// let id of direction as origin, then use position as offset
[numthreads(8, 8, 1)]
void CascadeMerge(uint3 id : SV_DispatchThreadID)
{
    // |-| <- sqrtNDirection
    // |_|
    uint sqrtBaseNDirection = sqrt(_DirectionCount);
    uint nDirection = _CascadeId == 0 ? 1 : _DirectionCount << 2 * (_CascadeId - 1);
    uint sqrtNDirection = _CascadeId == 0 ? 1 : sqrtBaseNDirection << (_CascadeId - 1);
    float tMin = _CascadeId == 0 ? 0. : _IntervalLength * (1 << 2 * (_CascadeId - 1));
    float tMax = _IntervalLength * (1 << 2 * _CascadeId);
    float2 nProbe = ceil(_Size / (1 << _CascadeId));
    float2 ij = floor(id.xy / nProbe);
    uint k = ij.y * sqrtNDirection + ij.x;
    float2 cascadeOrigin = ij * nProbe;
    float2 cascadeOffset = id.xy - cascadeOrigin;
    float2 offsetUV = float2(cascadeOffset) / nProbe;
    float2 o = ((cascadeOffset + 0.5) / nProbe) * _Size;
    float3 acc = 0;
    // 0 1 2 3 ->
    // 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15
    // 0
    // 0 1 2 3
    uint kk = k * 4;
    for (uint i = 0; i < 4; i++)
    {
        float omega = (kk + 0.5) / nDirection / 4. * 2. * 3.1415926;
        float2 d = float2(cos(omega), sin(omega));
        float4 ri = RadianceInterval(o + tMin * d, d, tMax);
        acc += ri.w * FetchLastCascade(kk, cascadeOffset, sqrtNDirection << 1) + ri.xyz;
        kk++;
    }
    _Result[id.xy] = float4(acc * 0.25, 1);
}

// The first cascade pass named final, because we will merge intervals back-to-front
[numthreads(8, 8, 1)]
void CascadeFinal(uint3 id : SV_DispatchThreadID)
{    
    uint sqrtBaseNDirection = sqrt(_DirectionCount);
    uint nDirection = _CascadeId == 0 ? 1 : _DirectionCount << 2 * (_CascadeId - 1);
    uint sqrtNDirection = _CascadeId == 0 ? 1 : sqrtBaseNDirection << (_CascadeId - 1);
    float tMin = _CascadeId == 0 ? 0. : _IntervalLength * (1 << 2 * (_CascadeId - 1));
    float tMax = _IntervalLength * (1 << 2 * _CascadeId);
    float2 nProbe = ceil(_Size / (1 << _CascadeId));
    float2 ij = floor(id.xy / nProbe);
    uint k = ij.y * sqrtNDirection + ij.x;
    float2 cascadeOrigin = ij * nProbe;
    float2 cascadeOffset = id.xy - cascadeOrigin;
    float2 offsetUV = float2(cascadeOffset) / nProbe;
    float2 o = ((cascadeOffset + 0.5) / nProbe) * _Size;
    float2 sunDirection = float2(cos(_SunDirection), sin(_SunDirection));
    float3 acc = 0;
    uint kk = k * 4;
    for (uint i = 0; i < 4; i++)
    {
        float omega = (kk + 0.5) / nDirection / 4. * 2. * 3.1415926;
        float2 d = float2(cos(omega), sin(omega));
        float4 ri = RadianceInterval(o + tMin * d, d, tMax);
        acc += ri.w * (1. + dot(d, sunDirection)) * 0.5 * _SunColor + ri.xyz;
        kk++;
    }
    _Result[id.xy] = float4(acc * 0.25, 1);
}
```
